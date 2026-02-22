import logging
import secrets
import httpx
from datetime import datetime, timedelta
from config import (
    RESEND_API_KEY,
    BREVO_API_KEY,
    FROM_EMAIL,
    CODE_EXPIRY_SECONDS,
)

logger = logging.getLogger("voting_app")

CODE_LENGTH = 6


def generate_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))


async def send_code_resend(to_email: str, code: str) -> bool:
    if not RESEND_API_KEY:
        return False
    payload = {
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": "Your login code",
        "html": f"<p>Your verification code is: <strong>{code}</strong></p><p>It expires in {CODE_EXPIRY_SECONDS // 60} minutes.</p>",
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            timeout=10.0,
        )
    return r.status_code == 200


def _sender_email() -> str:
    s = FROM_EMAIL.strip()
    if "<" in s and ">" in s:
        return s.split("<")[-1].strip(">")
    return s


async def send_code_brevo(to_email: str, code: str) -> bool:
    if not BREVO_API_KEY:
        logger.warning("Brevo: BREVO_API_KEY not set, skipping send")
        return False
    sender_email = _sender_email()
    payload = {
        "sender": {"name": "SHOMACS MeetPulse", "email": sender_email},
        "to": [{"email": to_email}],
        "subject": "Your login code",
        "htmlContent": f"<p>Your verification code is: <strong>{code}</strong></p><p>It expires in {CODE_EXPIRY_SECONDS // 60} minutes.</p>",
    }
    logger.info("Brevo: sending email to %s from %s", to_email, sender_email)
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                json=payload,
                headers={"api-key": BREVO_API_KEY},
                timeout=10.0,
            )
        if r.status_code in (200, 201):
            logger.info("Brevo: email sent successfully (status %s)", r.status_code)
            return True
        logger.error(
            "Brevo: send failed status=%s body=%s",
            r.status_code,
            r.text[:500] if r.text else "(empty)",
        )
        return False
    except Exception as e:
        logger.exception("Brevo: request failed: %s", e)
        return False


async def send_verification_code(to_email: str, code: str) -> bool:
    if RESEND_API_KEY:
        return await send_code_resend(to_email, code)
    if BREVO_API_KEY:
        return await send_code_brevo(to_email, code)
    # Dev fallback: print to console
    logger.warning("No email provider configured. Code for %s: %s", to_email, code)
    return True


async def _send_email(to_email: str, subject: str, html: str) -> bool:
    """Low-level single email send — uses whichever provider is configured."""
    if RESEND_API_KEY:
        payload = {"from": FROM_EMAIL, "to": [to_email], "subject": subject, "html": html}
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                timeout=10.0,
            )
        return r.status_code == 200
    if BREVO_API_KEY:
        sender_email = _sender_email()
        payload = {
            "sender": {"name": "SHOMACS MeetPulse", "email": sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html,
        }
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    json=payload,
                    headers={"api-key": BREVO_API_KEY},
                    timeout=10.0,
                )
            return r.status_code in (200, 201)
        except Exception:
            return False
    return False


async def notify_admins_pending_approval(admin_emails: list[str], new_user_name: str, new_user_email: str) -> None:
    """Email all admins when a new user is waiting for approval."""
    if not admin_emails:
        return
    subject = "SHOMACS MeetPulse — New user pending approval"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#4f46e5">New user is waiting for approval</h2>
      <p>A new member has signed up and needs your approval before they can access the app.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr>
          <td style="padding:8px 12px;background:#f8f9fa;font-weight:600;width:80px">Name</td>
          <td style="padding:8px 12px;border-left:3px solid #4f46e5">{new_user_name or '(not provided)'}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f8f9fa;font-weight:600">Email</td>
          <td style="padding:8px 12px;border-left:3px solid #4f46e5">{new_user_email}</td>
        </tr>
      </table>
      <p>Log in to the admin panel and go to <strong>Users → Pending Approvals</strong> to approve or ignore.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">SHOMACS MeetPulse — automated notification</p>
    </div>
    """
    for admin_email in admin_emails:
        ok = await _send_email(admin_email, subject, html)
        if ok:
            logger.info("ADMIN_NOTIFIED admin=%s new_user=%s", admin_email, new_user_email)
        else:
            logger.warning("ADMIN_NOTIFY_FAILED admin=%s new_user=%s", admin_email, new_user_email)
