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
        "sender": {"name": "Voting App", "email": sender_email},
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
