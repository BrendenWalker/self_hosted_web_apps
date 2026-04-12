import os, smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select, func, asc, desc, and_
from db import SessionLocal
from models import Activity, Pet, Setting
import socket


def build_weekly_summary_text(start_dt, end_dt):
    session = SessionLocal()
    try:
        # fetch activities in range
        q = select(Activity).where(and_(Activity.created_at >= start_dt, Activity.created_at < end_dt)).order_by(asc(Activity.created_at))
        acts = session.execute(q).scalars().all()

        # group counts
        per_pet = {}
        for a in acts:
            pet = a.pet.name if a.pet else "Unassigned"
            per_pet.setdefault(pet, {"total":0, "by_type":{}})
            per_pet[pet]["total"] += 1
            per_pet[pet]["by_type"][a.activity_type] = per_pet[pet]["by_type"].get(a.activity_type, 0) + 1

        lines = []
        lines.append(f"Weekly Pet Activity Summary")
        lines.append(f"Range: {start_dt.isoformat()} to {end_dt.isoformat()}")
        lines.append("")
        if not per_pet:
            lines.append("No activity recorded this week.")
        else:
            for pet, data in sorted(per_pet.items()):
                lines.append(f"• {pet}: {data['total']} entries")
                for t, c in sorted(data["by_type"].items()):
                    lines.append(f"    - {t}: {c}")
                # Note: legacy 'amount' values removed; potty details are now in rating
                lines.append("")
        return "\n".join(lines)
    finally:
        session.close()

def get_setting(key, default=""):
    """Get a setting value from the database, fallback to env var, then default"""
    session = SessionLocal()
    try:
        setting = session.scalars(select(Setting).where(Setting.key == key)).first()
        if setting and setting.value:
            return setting.value
        # Fallback to environment variable
        return os.getenv(key, default)
    finally:
        session.close()

def send_email(subject, body, html=None, to_addr=None, from_addr=None):
    host = get_setting("SMTP_HOST", "")
    port = int(get_setting("SMTP_PORT", "587"))
    user = get_setting("SMTP_USER", "")
    pwd = get_setting("SMTP_PASS", "")
    if to_addr is None:
        to_addr = get_setting("EMAIL_TO", "")
    if from_addr is None:
        from_addr = get_setting("EMAIL_FROM", "no-reply@example.com")

    if not (host and to_addr):
        print("Email not configured; skipping send.")
        return False

    # Validate DNS resolves early for clearer admin error messages
    try:
        socket.getaddrinfo(host, port)
    except socket.gaierror as e:
        raise Exception(f"Cannot resolve SMTP_HOST '{host}': {e}")

    timeout = float(get_setting("SMTP_TIMEOUT", "5"))  # seconds
    use_ssl = get_setting("SMTP_USE_SSL", "0") in ("1", "true", "True")
    use_starttls = get_setting("SMTP_STARTTLS", "1") in ("1", "true", "True") if not use_ssl else False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype='html')

    try:
        # Use direct TLS/SSL connection if enabled
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=timeout) as s:
                if user and pwd:
                    s.login(user, pwd)
                s.send_message(msg)
        else:
            # Use regular SMTP with optional STARTTLS
            with smtplib.SMTP(host, port, timeout=timeout) as s:
                # Try STARTTLS if enabled
                if use_starttls:
                    try:
                        s.starttls()
                    except smtplib.SMTPException as e:
                        # Provide clearer error and proceed without TLS if server doesn't support it
                        print("STARTTLS failed:", e)
                if user and pwd:
                    s.login(user, pwd)
                s.send_message(msg)
        return True
    except (socket.timeout, TimeoutError) as e:
        raise Exception(f"SMTP connection timed out to {host}:{port} after {timeout}s")
    except Exception as e:
        # Bubble up for caller to report
        raise


def purge_expired_invitations():
    session = SessionLocal()
    try:
        now = datetime.utcnow()
        # delete invitations that have expired and not accepted
        # No household invitations model present; nothing to purge
        return 0
    finally:
        session.close()

def schedule_weekly_summary(app):
    tz = pytz.timezone(get_setting("SUMMARY_TZ", "America/Los_Angeles"))
    day = get_setting("SUMMARY_DAY", "sunday").lower()
    hour = int(get_setting("SUMMARY_HOUR", "18"))
    dow_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
    }
    target_dow = dow_map.get(day, 6)

    scheduler = BackgroundScheduler(timezone=tz)
    def job():
        now = datetime.now(tz)
        # find start of week ending now at the configured DOW/hour
        # compute the period: previous 7 days ending at the run time
        end_dt = now
        start_dt = end_dt - timedelta(days=7)
        body = build_weekly_summary_text(start_dt, end_dt)
        subject = "Weekly Pet Activity Summary"
        send_email(subject, body)

    # schedule to run every day at hour, but guard with DOW check
    def conditional_job():
        now = datetime.now(tz)
        if now.weekday() == target_dow and now.hour == hour:
            job()

    scheduler.add_job(conditional_job, "cron", minute=0)  # check hourly on the hour
    # Purge expired invitations daily at 03:00
    try:
        scheduler.add_job(purge_expired_invitations, 'cron', hour=3, minute=0)
    except Exception:
        # best-effort
        pass
    scheduler.start()
    return scheduler