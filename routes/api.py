"""JSON REST API — consumed by the React frontend."""
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token, decode_access_token, code_expired, code_valid_for_seconds
from config import AUTO_APPROVE_FIRST_USER
from database import get_db
from email_service import generate_code, send_verification_code
from models import Meeting, PulsePoll, PulseOption, PulseVote, Question, QuestionVote, User

router = APIRouter(prefix="/api", tags=["api"])
logger = logging.getLogger("voting_app.api")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "phone": user.phone,
        "bio": user.bio,
        "is_admin": user.is_admin,
        "is_approved": user.is_approved,
    }


async def _get_current_user(request: Request, db: AsyncSession) -> Optional[User]:
    token = request.cookies.get("token")
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    email = payload.get("email")
    if not email:
        return None
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user or not user.is_approved:
        return None
    return user


def _set_auth_cookie(response: Response, token: str, request: Request) -> None:
    """Set the auth cookie. Mark Secure when served over HTTPS (e.g. ngrok)."""
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        "token", token,
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=is_https,
    )


def _unauth(msg: str = "Not authenticated") -> JSONResponse:
    return JSONResponse({"error": msg}, status_code=401)


def _forbidden(msg: str = "Forbidden") -> JSONResponse:
    return JSONResponse({"error": msg}, status_code=403)


def _not_found(msg: str = "Not found") -> JSONResponse:
    return JSONResponse({"error": msg}, status_code=404)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class SignupBody(BaseModel):
    name: str = ""
    email: str
    phone: str = ""
    bio: str = ""


class VerifyBody(BaseModel):
    email: str
    code: str


class LoginBody(BaseModel):
    email: str


@router.post("/auth/signup")
async def api_signup(body: SignupBody, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        return JSONResponse({"error": "Valid email required"}, status_code=400)
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if user and user.is_approved:
        return JSONResponse({"error": "Account exists. Log in instead."}, status_code=400)
    new_code = generate_code()
    expires = datetime.utcnow() + timedelta(seconds=code_valid_for_seconds())
    if user:
        user.name = body.name.strip() or user.name
        user.phone = body.phone.strip() or user.phone
        user.bio = body.bio.strip() or user.bio
        user.verification_code = new_code
        user.code_expires_at = expires
    else:
        user = User(
            name=body.name.strip() or None,
            email=email,
            phone=body.phone.strip() or None,
            bio=body.bio.strip() or None,
            is_approved=False,
            is_admin=False,
            verification_code=new_code,
            code_expires_at=expires,
        )
        db.add(user)
    await db.commit()
    await send_verification_code(email, new_code)
    logger.info("SIGNUP_OTP_SENT email=%s", email)
    return {"step": "verify", "email": email}


MAX_CODE_ATTEMPTS = 5


@router.post("/auth/signup/verify")
async def api_signup_verify(body: VerifyBody, response: Response, request: Request, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user:
        return JSONResponse({"error": "No signup in progress. Start again."}, status_code=400)
    if user.is_approved:
        return JSONResponse({"error": "Already verified. Log in."}, status_code=400)
    if code_expired(user.code_expires_at):
        return JSONResponse({"error": "Code expired. Request a new one."}, status_code=400)
    if (user.code_attempts or 0) >= MAX_CODE_ATTEMPTS:
        user.verification_code = None
        user.code_expires_at = None
        user.code_attempts = 0
        await db.commit()
        logger.warning("SIGNUP_OTP_LOCKED email=%s (too many attempts)", email)
        return JSONResponse({"error": "Too many attempts. Request a new code."}, status_code=400)
    if user.verification_code != body.code.strip():
        user.code_attempts = (user.code_attempts or 0) + 1
        await db.commit()
        remaining = MAX_CODE_ATTEMPTS - user.code_attempts
        logger.warning("SIGNUP_OTP_WRONG email=%s attempts=%d remaining=%d", email, user.code_attempts, remaining)
        return JSONResponse({"error": f"Invalid code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."}, status_code=400)
    count_r = await db.execute(select(func.count(User.id)))
    total = count_r.scalar() or 0
    if total <= 1:
        user.is_approved = True
        user.is_admin = True
    elif AUTO_APPROVE_FIRST_USER:
        user.is_approved = True
    user.verification_code = None
    user.code_expires_at = None
    user.code_attempts = 0
    await db.commit()
    if user.is_approved:
        token = create_access_token({"email": email})
        _set_auth_cookie(response, token, request)
        logger.info("SIGNUP_COMPLETE email=%s is_admin=%s", email, user.is_admin)
        return {"user": _user_dict(user)}
    logger.info("SIGNUP_PENDING_APPROVAL email=%s", email)
    return {"step": "pending_approval", "message": "Account verified. Wait for admin approval."}


@router.post("/auth/login")
async def api_login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user:
        return JSONResponse({"error": "No account found. Sign up first."}, status_code=404)
    if not user.is_approved:
        return JSONResponse({"error": "Account not approved yet."}, status_code=403)
    new_code = generate_code()
    user.verification_code = new_code
    user.code_expires_at = datetime.utcnow() + timedelta(seconds=code_valid_for_seconds())
    await db.commit()
    await send_verification_code(email, new_code)
    logger.info("LOGIN_OTP_SENT email=%s", email)
    return {"step": "verify", "email": email}


@router.post("/auth/login/verify")
async def api_login_verify(body: VerifyBody, response: Response, request: Request, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user or not user.is_approved:
        return JSONResponse({"error": "Account not found or not approved."}, status_code=404)
    if code_expired(user.code_expires_at):
        return JSONResponse({"error": "Code expired. Request a new one."}, status_code=400)
    if (user.code_attempts or 0) >= MAX_CODE_ATTEMPTS:
        user.verification_code = None
        user.code_expires_at = None
        user.code_attempts = 0
        await db.commit()
        logger.warning("LOGIN_OTP_LOCKED email=%s (too many attempts)", email)
        return JSONResponse({"error": "Too many attempts. Request a new code."}, status_code=400)
    if user.verification_code != body.code.strip():
        user.code_attempts = (user.code_attempts or 0) + 1
        await db.commit()
        remaining = MAX_CODE_ATTEMPTS - user.code_attempts
        logger.warning("LOGIN_OTP_WRONG email=%s attempts=%d remaining=%d", email, user.code_attempts, remaining)
        return JSONResponse({"error": f"Invalid code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."}, status_code=400)
    user.verification_code = None
    user.code_expires_at = None
    user.code_attempts = 0
    await db.commit()
    token = create_access_token({"email": email})
    _set_auth_cookie(response, token, request)
    logger.info("LOGIN_SUCCESS email=%s", email)
    return {"user": _user_dict(user)}


@router.post("/auth/logout")
async def api_logout(request: Request, response: Response):
    identity = request.cookies.get("token", "unknown")
    response.delete_cookie("token")
    logger.info("LOGOUT ip=%s", request.client.host if request.client else "unknown")
    return {"ok": True}


@router.get("/me")
async def api_me(request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        return _unauth()
    pending = 0
    if user.is_admin:
        r = await db.execute(select(func.count(User.id)).where(User.is_approved == False))
        pending = r.scalar() or 0
    return {"user": _user_dict(user), "pending_approvals": pending}


# ---------------------------------------------------------------------------
# Meetings
# ---------------------------------------------------------------------------

@router.get("/meetings")
async def api_meetings(request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        return _unauth()
    q = select(Meeting).order_by(Meeting.created_at.desc())
    if not user.is_admin:
        q = q.where(Meeting.is_visible == True)
    r = await db.execute(q)
    meetings = r.scalars().all()
    return [
        {"id": m.id, "title": m.title, "description": m.description,
         "created_at": m.created_at.isoformat(), "is_visible": m.is_visible}
        for m in meetings
    ]


class MeetingBody(BaseModel):
    title: str
    description: str = ""


@router.post("/meetings")
async def api_create_meeting(body: MeetingBody, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    m = Meeting(title=body.title.strip(), description=body.description.strip() or None, created_by_id=user.id)
    db.add(m)
    await db.commit()
    logger.info("MEETING_CREATED by=%s meeting_id=%d title=%r", user.email, m.id, m.title)
    return {"id": m.id, "title": m.title, "description": m.description}


# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------

@router.get("/meetings/{meeting_id}/questions")
async def api_questions(meeting_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        return _unauth()
    r = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not r.scalar_one_or_none():
        return _not_found()
    q = (
        select(Question)
        .where(Question.meeting_id == meeting_id)
        .options(selectinload(Question.author), selectinload(Question.votes).selectinload(QuestionVote.user))
        .order_by(Question.created_at.desc())
    )
    result = await db.execute(q)
    questions = result.scalars().all()
    data = []
    for q in questions:
        up = [v for v in q.votes if v.vote_type == "up"]
        down = [v for v in q.votes if v.vote_type == "down"]
        my_vote = next((v.vote_type for v in q.votes if v.user_id == user.id), None)
        data.append({
            "id": q.id,
            "text": q.text,
            "author": q.author.name or q.author.email,
            "created_at": q.created_at.isoformat(),
            "score": len(up) - len(down),
            "up_count": len(up),
            "down_count": len(down),
            "up_voters": [v.user.name or v.user.email for v in up],
            "down_voters": [v.user.name or v.user.email for v in down],
            "my_vote": my_vote,
        })
    return data


QUESTION_MAX_LENGTH = 1000


class QuestionBody(BaseModel):
    text: str


@router.post("/meetings/{meeting_id}/questions")
async def api_add_question(meeting_id: int, body: QuestionBody, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        return _unauth()
    text = body.text.strip()
    if not text:
        return JSONResponse({"error": "Question text cannot be empty."}, status_code=400)
    if len(text) > QUESTION_MAX_LENGTH:
        return JSONResponse({"error": f"Question too long (max {QUESTION_MAX_LENGTH} characters)."}, status_code=400)
    r = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not r.scalar_one_or_none():
        return _not_found()
    q = Question(meeting_id=meeting_id, text=text, author_id=user.id)
    db.add(q)
    await db.commit()
    logger.info("QUESTION_ADDED by=%s meeting_id=%d question_id=%d text=%r", user.email, meeting_id, q.id, text[:80])
    return {"id": q.id, "text": q.text}


class VoteBody(BaseModel):
    vote_type: str


@router.post("/questions/{question_id}/vote")
async def api_vote_question(question_id: int, body: VoteBody, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        return _unauth()
    if body.vote_type not in ("up", "down"):
        return JSONResponse({"error": "Invalid vote type"}, status_code=400)
    r = await db.execute(select(Question).where(Question.id == question_id))
    question = r.scalar_one_or_none()
    if not question:
        return _not_found()
    if question.author_id == user.id:
        return JSONResponse({"error": "You cannot vote on your own question."}, status_code=400)
    # Check existing vote
    ev = await db.execute(select(QuestionVote).where(QuestionVote.question_id == question_id, QuestionVote.user_id == user.id))
    existing = ev.scalar_one_or_none()
    if existing and existing.vote_type == body.vote_type:
        await db.delete(existing)
        await db.commit()
        logger.info("VOTE_REMOVED by=%s question_id=%d vote=%s", user.email, question_id, body.vote_type)
    else:
        await db.execute(delete(QuestionVote).where(QuestionVote.question_id == question_id, QuestionVote.user_id == user.id))
        db.add(QuestionVote(question_id=question_id, user_id=user.id, vote_type=body.vote_type))
        await db.commit()
        logger.info("VOTE_CAST by=%s question_id=%d vote=%s", user.email, question_id, body.vote_type)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Pulse
# ---------------------------------------------------------------------------

@router.get("/meetings/{meeting_id}/pulse")
async def api_pulse(meeting_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        return _unauth()
    r = await db.execute(
        select(PulsePoll)
        .where(PulsePoll.meeting_id == meeting_id, PulsePoll.is_active == True)
        .options(selectinload(PulsePoll.options).selectinload(PulseOption.votes).selectinload(PulseVote.user))
    )
    poll = r.scalar_one_or_none()
    if not poll:
        return {"active": False}
    opts_sorted = sorted(poll.options, key=lambda o: o.sort_order)
    total = sum(len(o.votes) for o in opts_sorted)
    my_option_id = None
    for o in opts_sorted:
        for v in o.votes:
            if v.user_id == user.id:
                my_option_id = o.id
    return {
        "active": True,
        "id": poll.id,
        "title": poll.title,
        "question_id": poll.question_id,
        "total_votes": total,
        "options": [{"id": o.id, "text": o.text, "votes": len(o.votes), "pct": round(len(o.votes) / total * 100) if total else 0, "my_vote": o.id == my_option_id} for o in opts_sorted],
    }


@router.post("/pulse/options/{option_id}/vote")
async def api_vote_pulse(option_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        return _unauth()
    r = await db.execute(select(PulseOption).where(PulseOption.id == option_id))
    option = r.scalar_one_or_none()
    if not option:
        return _not_found()
    # Ensure the poll is still active
    poll_r = await db.execute(select(PulsePoll).where(PulsePoll.id == option.poll_id))
    poll = poll_r.scalar_one_or_none()
    if not poll or not poll.is_active:
        return JSONResponse({"error": "This poll has ended."}, status_code=400)
    r = await db.execute(select(PulseOption).where(PulseOption.poll_id == option.poll_id))
    for o in r.scalars().all():
        await db.execute(delete(PulseVote).where(PulseVote.option_id == o.id, PulseVote.user_id == user.id))
    db.add(PulseVote(option_id=option_id, user_id=user.id))
    await db.commit()
    logger.info("PULSE_VOTE by=%s option_id=%d poll_id=%d", user.email, option_id, option.poll_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

@router.get("/profile")
async def api_profile(request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user:
        return _unauth()
    r = await db.execute(
        select(Question).where(Question.author_id == user.id).options(selectinload(Question.meeting)).order_by(Question.created_at.desc())
    )
    questions = r.scalars().all()
    return {
        "user": _user_dict(user),
        "questions": [{"id": q.id, "text": q.text, "meeting_id": q.meeting_id, "meeting_title": q.meeting.title if q.meeting else None, "created_at": q.created_at.isoformat()} for q in questions],
    }


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

@router.get("/admin/users")
async def api_admin_users(request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    pending_r = await db.execute(select(func.count(User.id)).where(User.is_approved == False))
    pending = pending_r.scalar() or 0
    r = await db.execute(select(User).order_by(User.created_at.desc()))
    users = r.scalars().all()
    # Single query: for every user get the distinct meeting titles they've contributed questions to
    from sqlalchemy import distinct as sa_distinct
    rows = await db.execute(
        select(Question.author_id, Meeting.title)
        .join(Meeting, Meeting.id == Question.meeting_id)
        .where(Question.author_id.in_([u.id for u in users]))
        .distinct()
    )
    user_meetings: dict[int, list[str]] = {u.id: [] for u in users}
    for author_id, title in rows.fetchall():
        user_meetings[author_id].append(title)
    return {
        "pending_count": pending,
        "users": [{**_user_dict(u), "created_at": u.created_at.isoformat(), "meetings": user_meetings[u.id]} for u in users],
    }


@router.post("/admin/users/{user_id}/approve")
async def api_approve_user(user_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    admin = await _get_current_user(request, db)
    if not admin or not admin.is_admin:
        return _forbidden()
    r = await db.execute(select(User).where(User.id == user_id))
    target = r.scalar_one_or_none()
    if not target:
        return _not_found()
    target.is_approved = True
    count_r = await db.execute(select(func.count(User.id)).where(User.is_admin == True))
    if (count_r.scalar() or 0) == 0:
        target.is_admin = True
    await db.commit()
    logger.info("USER_APPROVED by=%s target=%s", admin.email, target.email)
    return _user_dict(target)


@router.delete("/admin/users/{user_id}")
async def api_delete_user(user_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    current = await _get_current_user(request, db)
    if not current or not current.is_admin:
        return _forbidden()
    if current.id == user_id:
        return JSONResponse({"error": "You cannot delete your own account."}, status_code=400)
    r = await db.execute(select(User).where(User.id == user_id))
    target = r.scalar_one_or_none()
    if not target:
        return _not_found()
    if target.is_admin:
        count_r = await db.execute(select(func.count(User.id)).where(User.is_admin == True))
        if (count_r.scalar() or 0) <= 1:
            return JSONResponse({"error": "Cannot delete the last admin."}, status_code=400)
    # Delete the user's votes (questions/pulse options authored by others stay intact)
    await db.execute(delete(QuestionVote).where(QuestionVote.user_id == user_id))
    await db.execute(delete(PulseVote).where(PulseVote.user_id == user_id))
    # Delete questions authored by this user (cascades to their question votes)
    qr = await db.execute(select(Question).where(Question.author_id == user_id).options(selectinload(Question.votes)))
    for q in qr.scalars().all():
        await db.delete(q)
    await db.flush()
    await db.delete(target)
    await db.commit()
    logger.warning("USER_DELETED by=%s target=%s target_id=%d", current.email, target.email, user_id)
    return {"ok": True}


@router.post("/admin/users/{user_id}/toggle-admin")
async def api_toggle_admin(user_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    current = await _get_current_user(request, db)
    if not current or not current.is_admin:
        return _forbidden()
    if current.id == user_id:
        return JSONResponse({"error": "You cannot change your own admin status."}, status_code=400)
    r = await db.execute(select(User).where(User.id == user_id))
    target = r.scalar_one_or_none()
    if not target:
        return _not_found()
    # Prevent removing the last admin
    if target.is_admin:
        count_r = await db.execute(select(func.count(User.id)).where(User.is_admin == True))
        if (count_r.scalar() or 0) <= 1:
            return JSONResponse({"error": "Cannot remove the last admin."}, status_code=400)
    was_admin = target.is_admin
    target.is_admin = not target.is_admin
    await db.commit()
    logger.info("ADMIN_TOGGLED by=%s target=%s is_admin=%s→%s", current.email, target.email, was_admin, target.is_admin)
    return _user_dict(target)


@router.get("/admin/questions")
async def api_admin_questions(request: Request, meeting_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    q = select(Question).options(selectinload(Question.author), selectinload(Question.votes), selectinload(Question.meeting))
    if meeting_id:
        q = q.where(Question.meeting_id == meeting_id)
    result = await db.execute(q)
    questions = result.scalars().all()
    def score(q): return sum(1 for v in q.votes if v.vote_type == "up") - sum(1 for v in q.votes if v.vote_type == "down")
    data = sorted([{"id": q.id, "text": q.text, "score": score(q), "author": q.author.name or q.author.email, "meeting": q.meeting.title if q.meeting else None, "meeting_id": q.meeting_id, "created_at": q.created_at.isoformat()} for q in questions], key=lambda x: -x["score"])
    return data


@router.delete("/admin/questions/{question_id}")
async def api_delete_question(question_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    r = await db.execute(select(Question).where(Question.id == question_id))
    q = r.scalar_one_or_none()
    if q:
        await db.delete(q)
        await db.commit()
        logger.warning("QUESTION_DELETED by=%s question_id=%d text=%r", user.email, question_id, q.text[:80])
    return {"ok": True}


@router.get("/admin/meetings")
async def api_admin_meetings(request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    r = await db.execute(select(Meeting).order_by(Meeting.created_at.desc()))
    meetings = r.scalars().all()
    return [{"id": m.id, "title": m.title, "description": m.description, "is_visible": m.is_visible} for m in meetings]


@router.post("/admin/meetings/{meeting_id}/toggle-visibility")
async def api_toggle_meeting_visibility(meeting_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    r = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = r.scalar_one_or_none()
    if not meeting:
        return _not_found()
    meeting.is_visible = not meeting.is_visible
    await db.commit()
    logger.info("MEETING_VISIBILITY by=%s meeting_id=%d is_visible=%s", user.email, meeting_id, meeting.is_visible)
    return {"id": meeting.id, "is_visible": meeting.is_visible}


@router.get("/admin/pulse")
async def api_admin_pulse(request: Request, meeting_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    q = select(PulsePoll).where(PulsePoll.is_active == True).options(
        selectinload(PulsePoll.options).selectinload(PulseOption.votes),
        selectinload(PulsePoll.meeting),
        selectinload(PulsePoll.question),
    )
    if meeting_id:
        q = q.where(PulsePoll.meeting_id == meeting_id)
    r = await db.execute(q)
    poll = r.scalar_one_or_none()
    if not poll:
        return {"active": False}
    return {
        "active": True,
        "id": poll.id,
        "title": poll.title,
        "meeting": poll.meeting.title if poll.meeting else None,
        "question_text": poll.question.text if poll.question else None,
        "options": [{"id": o.id, "text": o.text, "votes": len(o.votes)} for o in sorted(poll.options, key=lambda x: x.sort_order)],
    }


class PulseStartBody(BaseModel):
    meeting_id: int
    question_id: Optional[int] = None
    title: str = ""
    options: list[str] = []


@router.post("/admin/pulse")
async def api_start_pulse(body: PulseStartBody, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    poll_title = body.title.strip() or "Session pulse"
    q_id = None
    if body.question_id:
        rq = await db.execute(select(Question).where(Question.id == body.question_id, Question.meeting_id == body.meeting_id))
        question = rq.scalar_one_or_none()
        if question:
            poll_title = question.text[:255]
            q_id = question.id
    r = await db.execute(select(PulsePoll).where(PulsePoll.meeting_id == body.meeting_id, PulsePoll.is_active == True))
    for p in r.scalars().all():
        p.is_active = False
    poll = PulsePoll(meeting_id=body.meeting_id, question_id=q_id, title=poll_title, is_active=True)
    db.add(poll)
    await db.flush()
    # Use admin-provided options if given, otherwise fall back to defaults
    custom = [o.strip() for o in body.options if o.strip()]
    if not custom:
        custom = ["Yes", "No", "Abstain"] if q_id else ["Great", "Good", "Okay", "Could be better"]
    for i, label in enumerate(custom):
        db.add(PulseOption(poll_id=poll.id, text=label, sort_order=i))
    await db.commit()
    logger.info("PULSE_STARTED by=%s meeting_id=%d poll_id=%d title=%r options=%s", user.email, body.meeting_id, poll.id, poll.title, custom)
    return {"id": poll.id, "title": poll.title}


@router.post("/admin/pulse/{poll_id}/end")
async def api_end_pulse(poll_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    r = await db.execute(select(PulsePoll).where(PulsePoll.id == poll_id))
    poll = r.scalar_one_or_none()
    if poll:
        poll.is_active = False
        await db.commit()
        logger.info("PULSE_ENDED by=%s poll_id=%d", user.email, poll_id)
    return {"ok": True}


@router.get("/admin/meeting-questions/{meeting_id}")
async def api_meeting_questions_for_pulse(meeting_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    if not user or not user.is_admin:
        return _forbidden()
    r = await db.execute(select(Question).where(Question.meeting_id == meeting_id).order_by(Question.created_at.desc()))
    questions = r.scalars().all()
    return [{"id": q.id, "text": q.text[:80]} for q in questions]
