import os
from collections import defaultdict
from datetime import datetime, timezone, date
from io import StringIO
import csv
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, Response
from flask_login import login_required, current_user, login_user, logout_user
from sqlalchemy import select, desc, asc, and_, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_, and_
import sqlalchemy as sa

from db import engine, SessionLocal
from models import Base, Activity, Pet, User, PetUser
from models import PetInvitation, Setting
import secrets
from datetime import timedelta
from werkzeug.security import check_password_hash, generate_password_hash

from auth import UserWrapper, login_manager, bp as auth_bp
from scheduler import schedule_weekly_summary, build_weekly_summary_text, send_email
from potty_hold import estimate_hold_hours, split_toilet_times_by_subtype
from sqlalchemy.orm import selectinload

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-key-change-me")

auto_sync = os.getenv("ENABLE_AUTO_SCHEMA_SYNC", "1") == "1"
if auto_sync:
    # Init DB schema and perform best-effort alters
    # IMPORTANT: This must complete before any queries that use Activity model
    # Use separate transactions for each operation to avoid transaction abort issues
    with engine.begin() as conn:
        Base.metadata.create_all(conn)
    
    # Fix alembic_version table if version_num column is too small (separate transaction)
    try:
        with engine.begin() as conn:
            inspector = sa.inspect(conn)
            if 'alembic_version' in inspector.get_table_names():
                columns = {col['name']: col for col in inspector.get_columns('alembic_version')}
                if 'version_num' in columns:
                    # Check if column is too small (Alembic defaults to 32, but we need at least 50)
                    col_type = str(columns['version_num']['type'])
                    if '32' in col_type or 'VARCHAR(32)' in col_type.upper():
                        conn.exec_driver_sql("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(50);")
                        print("Updated alembic_version.version_num column size to 50")
    except Exception as e:
        print(f"Note: Could not update alembic_version table: {e}")
    
    # Add / drop columns one at a time in separate transactions to avoid transaction abort issues
    def safe_exec(sql, description=""):
        try:
            with engine.begin() as conn:
                conn.exec_driver_sql(sql)
                if description:
                    print(description)
        except Exception:
            pass
    
    # Remove legacy columns if present
    safe_exec("ALTER TABLE activities DROP COLUMN IF EXISTS moving_avg;")
    safe_exec("ALTER TABLE activities DROP COLUMN IF EXISTS amount;")
    
    # Ensure current columns exist
    safe_exec("ALTER TABLE activities ADD COLUMN IF NOT EXISTS pet_id INTEGER NULL REFERENCES pets(id) ON DELETE SET NULL;")
    safe_exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS default_pet_id INTEGER NULL REFERENCES pets(id) ON DELETE SET NULL;")
    safe_exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;")
    safe_exec("ALTER TABLE pets ADD COLUMN IF NOT EXISTS birthdate DATE NULL;")
    safe_exec("ALTER TABLE activities ADD COLUMN IF NOT EXISTS trend DOUBLE PRECISION NULL;")
    safe_exec("ALTER TABLE activities ADD COLUMN IF NOT EXISTS variance DOUBLE PRECISION NULL;")

# Auth setup
login_manager.init_app(app)


@login_manager.unauthorized_handler
def _unauthorized():
    if request.path.startswith("/api"):
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    return redirect(url_for("auth.login", next=request.url))


app.register_blueprint(auth_bp)

from flask_cors import CORS

_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3002").split(",") if o.strip()]
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": _cors_origins}})


@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    if current_user.is_authenticated:
        u = current_user.user
        return jsonify({"ok": True, "user": {"id": u.id, "email": u.email, "is_admin": bool(u.is_admin)}})
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"ok": False, "error": "email and password required"}), 400
    session = SessionLocal()
    try:
        u = session.scalars(select(User).where(func.lower(User.email) == email)).first()
        if not u or not check_password_hash(u.password_hash, password):
            return jsonify({"ok": False, "error": "invalid email or password"}), 401
        login_user(UserWrapper(u))
        return jsonify({"ok": True, "user": {"id": u.id, "email": u.email, "is_admin": bool(u.is_admin)}})
    finally:
        session.close()


@app.route("/api/auth/logout", methods=["POST"])
@login_required
def api_auth_logout():
    logout_user()
    return jsonify({"ok": True})


@app.route("/api/auth/me", methods=["GET"])
def api_auth_me():
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False})
    session = SessionLocal()
    try:
        uid = int(current_user.get_id())
        user = session.get(User, uid)
        is_admin = bool(user.is_admin) if user else False
        u = current_user.user
        return jsonify(
            {
                "authenticated": True,
                "user": {"id": u.id, "email": u.email, "is_admin": is_admin},
            }
        )
    finally:
        session.close()


@app.route("/api/auth/signup", methods=["POST"])
def api_auth_signup():
    if os.getenv("ALLOW_SIGNUP", "1") != "1":
        return jsonify({"ok": False, "error": "signup disabled"}), 403
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"ok": False, "error": "email and password required"}), 400
    session = SessionLocal()
    try:
        existing = session.scalars(select(User).where(func.lower(User.email) == email)).first()
        if existing:
            return jsonify({"ok": False, "error": "email already registered"}), 409
        u = User(email=email, password_hash=generate_password_hash(password))
        session.add(u)
        session.commit()
        return jsonify({"ok": True})
    except SQLAlchemyError as e:
        session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/health")
def api_health():
    """Container health check; does not query the database."""
    return jsonify(
        {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": os.getenv("VERSION", os.getenv("DOCKER_IMAGE_TAG", "dev")),
        }
    )

def _should_start_scheduler():
    if os.getenv("ENABLE_SCHEDULER", "1") != "1":
        return False
    # In Flask debug, only start in the reloader child
    if os.getenv("FLASK_DEBUG") == "1":
        return os.getenv("WERKZEUG_RUN_MAIN") == "true"
    # In prod, set SCHED_PRIMARY=1 on exactly one worker
    return os.getenv("SCHED_PRIMARY", "1") == "1"

# replace your unguarded call:
# schedule_weekly_summary(app)
if _should_start_scheduler():
    schedule_weekly_summary(app)

@app.context_processor
def inject_user():
    is_admin = False
    if current_user.is_authenticated:
        session = SessionLocal()
        try:
            user_id = int(current_user.get_id())
            user = session.get(User, user_id)
            is_admin = user.is_admin if user else False
        finally:
            session.close()
    image_version = os.getenv("DOCKER_IMAGE_TAG", "dev")
    return dict(current_user=current_user, is_admin=is_admin, image_version=image_version)

@app.template_filter('localtime')
def localtime_filter(dt):
    """Convert UTC datetime to local time for display"""
    if dt is None:
        return ''
    # Database returns naive datetime, assume it's UTC
    if dt.tzinfo is None:
        # Create a timezone-aware UTC datetime
        dt = dt.replace(tzinfo=timezone.utc)
    # Convert to local time (server's local time)
    local_dt = dt.astimezone()
    # Format as readable string
    return local_dt.strftime('%Y-%m-%d %H:%M:%S')

@app.route("/", methods=["GET"])
@login_required
def index():
    session = SessionLocal()
    try:
        # Limit pets and recent activities to the pets this user has access to
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids)).order_by(asc(Pet.name))).all()

        q = (
            select(Activity)
            .options(selectinload(Activity.pet))
            .join(Pet, Activity.pet_id == Pet.id)
            .join(PetUser, PetUser.pet_id == Pet.id)
            .where(PetUser.user_id == user_id)
            .order_by(desc(Activity.created_at))
            .limit(50)
        )
        activities = session.scalars(q).all()
        return render_template("index.html", activities=activities, pets=pets)
    finally:
        session.close()


@app.route("/api/dashboard", methods=["GET"])
@login_required
def api_dashboard():
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids)).order_by(asc(Pet.name))).all()
        q = (
            select(Activity)
            .options(selectinload(Activity.pet))
            .join(Pet, Activity.pet_id == Pet.id)
            .join(PetUser, PetUser.pet_id == Pet.id)
            .where(PetUser.user_id == user_id)
            .order_by(desc(Activity.created_at))
            .limit(50)
        )
        activities = session.scalars(q).all()
        return jsonify(
            {
                "pets": [
                    {"id": p.id, "name": p.name, "birthdate": p.birthdate.isoformat() if p.birthdate else None}
                    for p in pets
                ],
                "activities": [
                    {
                        "id": a.id,
                        "activity_type": a.activity_type,
                        "sub_type": a.sub_type,
                        "location": a.location,
                        "rating": a.rating,
                        "notes": a.notes,
                        "pet_id": a.pet_id,
                        "pet_name": a.pet.name if a.pet else None,
                        "created_at": a.created_at.isoformat()
                        if hasattr(a.created_at, "isoformat")
                        else str(a.created_at),
                    }
                    for a in activities
                ],
            }
        )
    finally:
        session.close()


@app.route('/pets/manage', methods=['GET'])
@login_required
def pets_manage():
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids))).all()
        # load members and invites
        now = datetime.utcnow()
        for p in pets:
            p.members = [pu.user for pu in session.scalars(select(PetUser).where(PetUser.pet_id == p.id)).all()]
            p.invites = session.scalars(select(PetInvitation).where(PetInvitation.pet_id == p.id, PetInvitation.accepted == False, or_(PetInvitation.expires_at == None, PetInvitation.expires_at > now))).all()
        return render_template('pet_members.html', pets=pets)
    finally:
        session.close()


@app.route("/api/pets/manage", methods=["GET"])
@login_required
def api_pets_manage():
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids))).all()
        now = datetime.now(timezone.utc)
        out = []
        for p in pets:
            memberships = session.scalars(select(PetUser).where(PetUser.pet_id == p.id)).all()
            members = []
            for pu in memberships:
                u = session.get(User, pu.user_id)
                if u:
                    members.append({"user_id": u.id, "email": u.email, "is_manager": pu.is_manager})
            invites = session.scalars(
                select(PetInvitation).where(
                    PetInvitation.pet_id == p.id,
                    PetInvitation.accepted == False,
                    or_(PetInvitation.expires_at == None, PetInvitation.expires_at > now),
                )
            ).all()
            out.append(
                {
                    "id": p.id,
                    "name": p.name,
                    "birthdate": p.birthdate.isoformat() if p.birthdate else None,
                    "members": members,
                    "invites": [
                        {
                            "id": inv.id,
                            "invite_email": inv.invite_email,
                            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
                        }
                        for inv in invites
                    ],
                }
            )
        return jsonify(out)
    finally:
        session.close()


@app.route('/pets/<int:pid>/add_user', methods=['POST'])
@app.route('/api/pets/<int:pid>/add_user', methods=['POST'])
@login_required
def pet_add_user(pid: int):
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        # only managers can add users
        mgr = session.scalars(select(PetUser).where(PetUser.pet_id == pid, PetUser.user_id == user_id, PetUser.is_manager == True)).first()
        if not mgr:
            return jsonify({'ok': False, 'error': 'only pet managers can add users'}), 403
        data = request.get_json() if request.is_json else request.form
        email = (data.get('email') or '').strip().lower()
        if not email:
            return jsonify({'ok': False, 'error': 'email required'}), 400
        target = session.scalars(select(User).where(func.lower(User.email) == email)).first()
        if not target:
            return jsonify({'ok': False, 'error': 'user not found'}), 404
        existing = session.scalars(select(PetUser).where(PetUser.pet_id == pid, PetUser.user_id == target.id)).first()
        if existing:
            return jsonify({'ok': True, 'message': 'already member'})
        pu = PetUser(pet_id=pid, user_id=target.id, is_manager=False)
        session.add(pu)
        session.commit()
        return jsonify({'ok': True, 'user': {'id': target.id, 'email': target.email}})
    finally:
        session.close()


@app.route('/pets/<int:pid>/remove_user', methods=['POST'])
@app.route('/api/pets/<int:pid>/remove_user', methods=['POST'])
@login_required
def pet_remove_user(pid: int):
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        mgr = session.scalars(select(PetUser).where(PetUser.pet_id == pid, PetUser.user_id == user_id, PetUser.is_manager == True)).first()
        if not mgr:
            return jsonify({'ok': False, 'error': 'only pet managers can remove users'}), 403
        target_id = request.get_json().get('user_id') if request.is_json else request.form.get('user_id')
        try:
            target_id = int(target_id)
        except Exception:
            return jsonify({'ok': False, 'error': 'invalid user id'}), 400
        pu = session.scalars(select(PetUser).where(PetUser.pet_id == pid, PetUser.user_id == target_id)).first()
        if not pu:
            return jsonify({'ok': False, 'error': 'not a member'}), 404
        session.delete(pu)
        session.commit()
        return jsonify({'ok': True})
    finally:
        session.close()


@app.route('/pets/<int:pid>/invite', methods=['POST'])
@app.route('/api/pets/<int:pid>/invite', methods=['POST'])
@login_required
def pet_invite(pid: int):
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        mgr = session.scalars(select(PetUser).where(PetUser.pet_id == pid, PetUser.user_id == user_id, PetUser.is_manager == True)).first()
        if not mgr:
            return jsonify({'ok': False, 'error': 'only pet managers can invite'}), 403
        data = request.get_json() if request.is_json else request.form
        email = (data.get('email') or '').strip().lower()
        if not email:
            return jsonify({'ok': False, 'error': 'email required'}), 400
        token = secrets.token_urlsafe(24)
        days = int(os.getenv('INVITE_EXPIRE_DAYS', '7'))
        expires_at = datetime.utcnow() + timedelta(days=days)
        inv = PetInvitation(pet_id=pid, invite_email=email, token=token, expires_at=expires_at)
        session.add(inv)
        session.commit()
        link = url_for('pet_invite_accept_page', token=token, _external=True)
        subject = f"You're invited to access a pet in Pet Activity Tracker"
        body = f"You have been invited to access a pet. Click to accept: {link}\n\nIf you didn't expect this, ignore this email."
        html = f"<p>You have been invited to access a pet on Pet Activity Tracker.</p><p><a href=\"{link}\">Accept invitation</a></p>"
        try:
            send_email(subject, body, html=html, to_addr=email)
        except Exception as e:
            print('Error sending invite email:', e)
        return jsonify({'ok': True, 'invite_link': link, 'id': inv.id})
    finally:
        session.close()


@app.route('/pets/<int:pid>/invites/<int:inv_id>/revoke', methods=['POST'])
@app.route('/api/pets/<int:pid>/invites/<int:inv_id>/revoke', methods=['POST'])
@login_required
def pet_invite_revoke(pid:int, inv_id:int):
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        mgr = session.scalars(select(PetUser).where(PetUser.pet_id == pid, PetUser.user_id == user_id, PetUser.is_manager == True)).first()
        if not mgr:
            return jsonify({'ok': False, 'error': 'only managers can revoke invites'}), 403
        inv = session.get(PetInvitation, inv_id)
        if not inv or inv.pet_id != pid:
            return jsonify({'ok': False, 'error': 'invite not found'}), 404
        session.delete(inv)
        session.commit()
        return jsonify({'ok': True})
    finally:
        session.close()


@app.route('/pets/<int:pid>/delete', methods=['POST'])
@app.route('/api/pets/<int:pid>/delete', methods=['POST'])
@login_required
def pet_delete(pid: int):
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        # only managers may delete the pet
        mgr = session.scalars(select(PetUser).where(PetUser.pet_id == pid, PetUser.user_id == user_id, PetUser.is_manager == True)).first()
        if not mgr:
            return jsonify({'ok': False, 'error': 'only pet managers can delete pets'}), 403
        pet = session.get(Pet, pid)
        if not pet:
            return jsonify({'ok': False, 'error': 'pet not found'}), 404
        session.delete(pet)
        session.commit()
        return jsonify({'ok': True})
    finally:
        session.close()


@app.route('/invite/pet/<token>', methods=['GET'])
@login_required
def pet_invite_accept_page(token:str):
    session = SessionLocal()
    try:
        inv = session.scalars(select(PetInvitation).options(selectinload(PetInvitation.pet)).where(PetInvitation.token == token)).first()
        if not inv:
            flash('Invitation not found', 'warning')
            return redirect(url_for('index'))
        # Check if invite is expired
        now = datetime.now(timezone.utc)
        if inv.expires_at and inv.expires_at < now:
            flash('This invitation has expired', 'warning')
            return redirect(url_for('index'))
        return render_template('pet_invite_accept.html', invite=inv)
    finally:
        session.close()


@app.route("/api/invite/pet/<token>", methods=["GET"])
@login_required
def api_invite_pet(token: str):
    session = SessionLocal()
    try:
        inv = session.scalars(
            select(PetInvitation).options(selectinload(PetInvitation.pet)).where(PetInvitation.token == token)
        ).first()
        if not inv:
            return jsonify({"ok": False, "error": "not found"}), 404
        now = datetime.now(timezone.utc)
        exp = inv.expires_at
        if exp:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            else:
                exp = exp.astimezone(timezone.utc)
        expired = bool(exp and exp < now)
        return jsonify(
            {
                "ok": True,
                "invite_email": inv.invite_email,
                "pet_name": inv.pet.name if inv.pet else None,
                "expired": expired,
                "accepted": inv.accepted,
            }
        )
    finally:
        session.close()


@app.route('/invite/pet/<token>/accept', methods=['POST'])
@app.route('/api/invite/pet/<token>/accept', methods=['POST'])
@login_required
def pet_invite_accept(token:str):
    session = SessionLocal()
    try:
        inv = session.scalars(select(PetInvitation).where(PetInvitation.token == token)).first()
        if not inv:
            return jsonify({'ok': False, 'error': 'invalid invite'}), 404
        if inv.accepted:
            return jsonify({'ok': False, 'error': 'invite already used'}), 400
        # Check if invite is expired
        now = datetime.now(timezone.utc)
        if inv.expires_at and inv.expires_at < now:
            return jsonify({'ok': False, 'error': 'invite has expired'}), 400
        if current_user.user.email.lower() != inv.invite_email.lower():
            return jsonify({'ok': False, 'error': 'invite email does not match your account email'}), 403
        pu = PetUser(pet_id=inv.pet_id, user_id=current_user.user.id, is_manager=False)
        session.add(pu)
        inv.accepted = True
        inv.used_by_user_id = current_user.user.id
        session.add(inv)
        session.commit()
        return jsonify({'ok': True}) if request.is_json else redirect(url_for('index'))
    finally:
        session.close()

# ----------------------------- Admin Helpers -----------------------------
def admin_required(f):
    """Decorator to require admin access"""
    from functools import wraps
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        session = SessionLocal()
        try:
            user_id = int(current_user.get_id())
            user = session.get(User, user_id)
            if not user or not user.is_admin:
                if request.path.startswith("/api/"):
                    return jsonify({"ok": False, "error": "admin required"}), 403
                flash("Admin access required", "danger")
                return redirect(url_for("index"))
        finally:
            session.close()
        return f(*args, **kwargs)
    return decorated_function

# ----------------------------- Admin Page -----------------------------
@app.route("/admin", methods=["GET"])
@admin_required
def admin():
    session = SessionLocal()
    try:
        users = session.scalars(select(User).order_by(asc(User.email))).all()
        # Get all settings
        settings = session.scalars(select(Setting).order_by(asc(Setting.key))).all()
        settings_dict = {s.key: s.value for s in settings}
        return render_template("admin.html", users=users, settings=settings_dict)
    finally:
        session.close()


@app.route("/api/admin/overview", methods=["GET"])
@admin_required
def api_admin_overview():
    session = SessionLocal()
    try:
        users = session.scalars(select(User).order_by(asc(User.email))).all()
        settings = session.scalars(select(Setting).order_by(asc(Setting.key))).all()
        settings_dict = {s.key: s.value for s in settings}
        return jsonify(
            {
                "users": [
                    {
                        "id": u.id,
                        "email": u.email,
                        "is_active": u.is_active,
                        "is_admin": u.is_admin,
                    }
                    for u in users
                ],
                "settings": settings_dict,
            }
        )
    finally:
        session.close()


@app.route("/admin/users/<int:user_id>", methods=["POST"])
@app.route("/api/admin/users/<int:user_id>", methods=["POST"])
@admin_required
def admin_update_user(user_id):
    session = SessionLocal()
    try:
        user = session.get(User, user_id)
        if not user:
            return jsonify({"ok": False, "error": "User not found"}), 404
        
        data = request.get_json() if request.is_json else request.form
        if "email" in data:
            email = (data.get("email") or "").strip().lower()
            if email:
                # Check if email is already taken by another user
                existing = session.scalars(select(User).where(func.lower(User.email) == email, User.id != user_id)).first()
                if existing:
                    return jsonify({"ok": False, "error": "Email already in use"}), 400
                user.email = email
        
        if "is_active" in data:
            user.is_active = bool(data.get("is_active"))
        
        if "is_admin" in data:
            user.is_admin = bool(data.get("is_admin"))
        
        if "password" in data and data.get("password"):
            user.password_hash = generate_password_hash(data.get("password"))
        
        session.add(user)
        session.commit()
        return jsonify({"ok": True, "user": {"id": user.id, "email": user.email, "is_active": user.is_active, "is_admin": user.is_admin}})
    except SQLAlchemyError as e:
        session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        session.close()

@app.route("/admin/settings", methods=["POST"])
@app.route("/api/admin/settings", methods=["POST"])
@admin_required
def admin_update_settings():
    session = SessionLocal()
    try:
        data = request.get_json() if request.is_json else request.form
        updated = {}
        
        # Mail settings
        mail_keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USE_SSL", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM", "EMAIL_TO", "SUMMARY_DAY", "SUMMARY_HOUR", "SUMMARY_TZ"]
        for key in mail_keys:
            if key in data:
                value = data.get(key) or ""
                setting = session.scalars(select(Setting).where(Setting.key == key)).first()
                if setting:
                    setting.value = value
                    setting.updated_at = datetime.now(timezone.utc)
                else:
                    setting = Setting(key=key, value=value)
                    session.add(setting)
                updated[key] = value
        
        session.commit()
        return jsonify({"ok": True, "updated": updated})
    except SQLAlchemyError as e:
        session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        session.close()

@app.route("/admin/test_email", methods=["POST", "OPTIONS"])
@app.route("/api/admin/test_email", methods=["POST", "OPTIONS"])
@admin_required
def admin_test_email():
    try:
        if request.method == "OPTIONS":
            return jsonify({"ok": True, "preflight": True})
        raw = request.get_data(as_text=True)
        print("/admin/test_email RAW:", raw)
        data = request.get_json(silent=True)
        if data is None:
            data = request.form
        print("/admin/test_email PARSED:", data)
        to_addr = (data.get("to") or "").strip() if data else ""
        if not to_addr:
            return jsonify({"ok": False, "error": "Recipient address required", "raw": raw}), 400
        subject = "PetHub Test Email"
        body = "This is a test email from PetHub admin settings."
        ok = send_email(subject, body, to_addr=to_addr)
        if ok:
            return jsonify({"ok": True, "to": to_addr, "message": f"Test email sent to {to_addr}"})
        return jsonify({"ok": False, "error": "Email not configured or send failed", "raw": raw}), 400
    except Exception as e:
        print("/admin/test_email ERROR:", e)
        return jsonify({"ok": False, "error": str(e)}), 500

# ----------------------------- Reports Page -----------------------------
@app.route("/reports", methods=["GET"])
@login_required
def reports():
    # Redirect to activity report by default
    return redirect(url_for("reports_activity"))

# ----------------------------- Recent Activity Page -----------------------------
@app.route("/reports/activity", methods=["GET"])
@login_required
def reports_activity():
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids)).order_by(asc(Pet.name))).all()
        return render_template("reports_activity.html", pets=pets)
    finally:
        session.close()


@app.route("/admin/recalc_trend", methods=["POST"])
@app.route("/api/admin/recalc_trend", methods=["POST"])
@admin_required
def admin_recalc_trend():
    """Recalculate trend/variance for all toilet activities, oldest to newest."""
    session = SessionLocal()
    try:
        # Fetch all toilet activities ordered by pet, subtype, and time
        stmt = (
            select(Activity)
            .where(Activity.activity_type == "toilet")
            .order_by(asc(Activity.pet_id), asc(Activity.sub_type), asc(Activity.created_at), asc(Activity.id))
        )
        activities = session.scalars(stmt).all()

        current_key = None  # (pet_id, sub_type)
        prev_event_dt = None
        prev_trend = None

        updated = 0
        skipped = 0

        for a in activities:
            key = (a.pet_id, (a.sub_type or "").lower())
            if key != current_key:
                # New group: reset state
                current_key = key
                prev_event_dt = None
                prev_trend = None

            # Normalize current timestamp to UTC
            curr_dt = a.created_at
            if curr_dt is None:
                skipped += 1
                continue
            if curr_dt.tzinfo is None:
                curr_dt = curr_dt.replace(tzinfo=timezone.utc)
            else:
                curr_dt = curr_dt.astimezone(timezone.utc)

            if prev_event_dt is None:
                # First event for this pet/sub_type: no interval yet
                a.trend = None
                a.variance = None
            else:
                interval_hours = (curr_dt - prev_event_dt).total_seconds() / 3600.0
                # Seed previous trend: use existing trend if any, else interval itself
                if prev_trend is None:
                    seed_trend = interval_hours
                else:
                    seed_trend = prev_trend
                new_trend = seed_trend + (0.1 * (interval_hours - seed_trend))
                a.trend = new_trend
                a.variance = interval_hours - new_trend
                prev_trend = new_trend
                updated += 1

            prev_event_dt = curr_dt

        session.commit()
        return jsonify({"ok": True, "updated": updated, "skipped": skipped})
    except SQLAlchemyError as e:
        session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        session.close()

# ----------------------------- Daily Counts Chart Page -----------------------------
@app.route("/reports/daily-counts", methods=["GET"])
@login_required
def reports_daily_counts():
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids)).order_by(asc(Pet.name))).all()
        return render_template("reports_daily_counts.html", pets=pets)
    finally:
        session.close()


# ----------------------------- Potty Hold Time Chart Page -----------------------------
@app.route("/reports/potty-hold-time", methods=["GET"])
@login_required
def reports_potty_hold_time():
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids)).order_by(asc(Pet.name))).all()
        return render_template("reports_potty_hold_time.html", pets=pets)
    finally:
        session.close()

# ----------------------------- Potty Location Chart Page -----------------------------
@app.route("/reports/potty-location", methods=["GET"])
@login_required
def reports_potty_location():
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids)).order_by(asc(Pet.name))).all()
        return render_template("reports_potty_location.html", pets=pets)
    finally:
        session.close()

# ----------------------------- Pets -----------------------------
@app.route("/pets", methods=["GET"])
@app.route("/api/pets", methods=["GET"])
@login_required
def list_pets():
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_ids = session.scalars(select(PetUser.pet_id).where(PetUser.user_id == user_id)).all()
        pets = session.scalars(select(Pet).where(Pet.id.in_(pet_ids)).order_by(asc(Pet.name))).all()
        return jsonify([{"id": p.id, "name": p.name} for p in pets])
    finally:
        session.close()

@app.route("/pets", methods=["POST"])
@app.route("/api/pets", methods=["POST"])
@login_required
def add_pet():
    data = request.get_json() if request.is_json else request.form
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "error": "name is required"}), 400

    session = SessionLocal()
    try:
        # If a pet with the same name exists, ensure current user is associated; otherwise create it
        existing = session.scalars(select(Pet).where(func.lower(Pet.name) == name.lower())).first()
        user_id = int(current_user.get_id())
        if existing:
            existing_assoc = session.scalars(select(PetUser).where(PetUser.pet_id == existing.id, PetUser.user_id == user_id)).first()
            if not existing_assoc:
                pu = PetUser(pet_id=existing.id, user_id=user_id, is_manager=False)
                session.add(pu)
                session.commit()
            return jsonify({"ok": True, "id": existing.id})
        pet = Pet(name=name)
        session.add(pet)
        session.flush()
        # associate current user as manager of the new pet
        pu = PetUser(pet_id=pet.id, user_id=user_id, is_manager=True)
        session.add(pu)
        session.commit()
        return jsonify({"ok": True, "id": pet.id})
    except SQLAlchemyError as e:
        session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        session.close()


@app.route("/pets/<int:pid>/update", methods=["POST"])
@app.route("/api/pets/<int:pid>/update", methods=["POST"])
@login_required
def update_pet(pid: int):
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        mgr = session.scalars(select(PetUser).where(PetUser.pet_id == pid, PetUser.user_id == user_id, PetUser.is_manager == True)).first()
        if not mgr:
            return jsonify({"ok": False, "error": "only pet managers can update pets"}), 403
        pet = session.get(Pet, pid)
        if not pet:
            return jsonify({"ok": False, "error": "pet not found"}), 404
        data = request.get_json() if request.is_json else request.form
        birthdate_raw = (data.get("birthdate") or "").strip() if data else ""
        if birthdate_raw:
            try:
                pet.birthdate = date.fromisoformat(birthdate_raw)
            except ValueError:
                return jsonify({"ok": False, "error": "invalid birthdate"}), 400
        else:
            pet.birthdate = None
        session.add(pet)
        session.commit()
        return jsonify({"ok": True, "birthdate": pet.birthdate.isoformat() if pet.birthdate else None})
    finally:
        session.close()


@app.route("/users/default_pet", methods=["GET", "POST"])
@app.route("/api/users/default_pet", methods=["GET", "POST"])
@login_required
def user_default_pet():
    session = SessionLocal()
    try:
        user = session.get(User, int(current_user.get_id()))
        if request.method == 'POST':
            data = request.get_json() if request.is_json else request.form
            pet_id = data.get('pet_id')
            if pet_id == '' or pet_id is None:
                user.default_pet_id = None
            else:
                try:
                    user.default_pet_id = int(pet_id)
                except ValueError:
                    return jsonify({'ok': False, 'error': 'invalid pet id'}), 400
            session.add(user)
            session.commit()
            return jsonify({'ok': True, 'default_pet_id': user.default_pet_id})
        else:
            return jsonify({'default_pet_id': user.default_pet_id})
    finally:
        session.close()

# ----------------------------- Helpers -----------------------------
def apply_filters(stmt, args):
    conditions = []
    pet_id = args.get("pet_id")
    if pet_id and pet_id != "all":
        try:
            conditions.append(Activity.pet_id == int(pet_id))
        except ValueError:
            pass
    activity_type = args.get("activity_type")
    if activity_type and activity_type != "all":
        conditions.append(Activity.activity_type == activity_type)
    sub_type = args.get("sub_type")
    if sub_type and sub_type != "all":
        conditions.append(Activity.sub_type == sub_type)
    start = args.get("start")
    end = args.get("end")
    def parse_date(x):
        try:
            # Parse datetime string (may be datetime-local format or ISO with timezone)
            dt_str = x.replace('Z', '+00:00') if 'Z' in x else x
            dt = datetime.fromisoformat(dt_str)
            # If naive (datetime-local format), treat as UTC for comparison
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            # Convert to UTC and remove timezone for database comparison (naive UTC)
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            return None
    if start:
        dt = parse_date(start)
        if dt:
            conditions.append(Activity.created_at >= dt)
    if end:
        dt = parse_date(end)
        if dt:
            conditions.append(Activity.created_at <= dt)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt

# ----------------------------- Activities API -----------------------------
@app.route("/add", methods=["POST"])
@app.route("/api/activity", methods=["POST"])
@login_required
def add():
    data = request.get_json() if request.is_json else request.form

    activity_type = (data.get("activity_type") or "").strip().lower()
    sub_type = (data.get("sub_type") or "").strip().lower() or None
    location = (data.get("location") or "").strip().lower() or None
    # rating & pet_id parsing unchanged...

    # read final inputs
    activity_type = data.get("activity_type") or activity_type
    location = data.get("location") or location
    rating = data.get("rating") if 'rating' in data else (rating if 'rating' in locals() else None)
    # amount column removed; ignore any incoming amount
    notes = data.get("notes") or None
    pet_id = data.get("pet_id")
    created_at_raw = data.get("created_at")

    if rating == "":
        rating = None
    else:
        rating = int(rating) if rating is not None else None

    if pet_id == "":
        pet_id = None
    else:
        pet_id = int(pet_id) if pet_id is not None else None

    created_at_dt = None
    if created_at_raw:
        try:
            # Parse the datetime string (may include 'Z' for UTC or timezone offset)
            dt_str = created_at_raw.replace('Z', '+00:00')
            dt = datetime.fromisoformat(dt_str)
            # If datetime is naive (no timezone), treat it as UTC
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            # Ensure we're in UTC (convert if needed)
            dt_utc = dt.astimezone(timezone.utc)
            created_at_dt = dt_utc
            print(f"DEBUG: Received {created_at_raw}, storing as timezone-aware UTC: {created_at_dt} (tzinfo: {created_at_dt.tzinfo})")
        except Exception as e:
            print(f"Error parsing created_at: {e}, value: {created_at_raw}")
            created_at_dt = None
    if created_at_dt is None:
        created_at_dt = datetime.now(timezone.utc)

    # Normalize toilet type
    if activity_type in ("potty", "toilet"):
        activity_type = 'toilet'

    if not activity_type:
        return jsonify({"ok": False, "error": "activity_type is required"}), 400

    session = SessionLocal()
    try:
        # Calculate trend/variance for toilet activities using interval smoothing (alpha=0.1)
        trend = None
        variance = None
        if activity_type == 'toilet' and sub_type and pet_id:
            # Find previous toilet event for this pet/sub_type
            prev_stmt = (
                select(Activity)
                .where(
                    and_(
                        Activity.pet_id == pet_id,
                        Activity.activity_type == "toilet",
                        Activity.sub_type == sub_type
                    )
                )
                .order_by(desc(Activity.created_at))
                .limit(1)
            )
            prev = session.scalars(prev_stmt).first()
            if prev and prev.created_at:
                prev_dt = prev.created_at
                if prev_dt.tzinfo is None:
                    prev_dt = prev_dt.replace(tzinfo=timezone.utc)
                else:
                    prev_dt = prev_dt.astimezone(timezone.utc)
                interval_hours = (created_at_dt - prev_dt).total_seconds() / 3600.0
                # Seed previous trend with previous trend if available, else with interval
                prev_trend = prev.trend if prev.trend is not None else interval_hours
                trend = prev_trend + (0.1 * (interval_hours - prev_trend))
                variance = interval_hours - trend
            else:
                # First event for this sub_type -> cannot compute interval
                trend = None
                variance = None

        activity = Activity(
            activity_type=activity_type,
            sub_type=sub_type,
            location=location,
            rating=rating,
            notes=notes,
            pet_id=pet_id,
            created_at=created_at_dt,
            trend=trend,
            variance=variance,
        )
        session.add(activity)
        session.commit()
        return jsonify({"ok": True, "id": activity.id})
    except SQLAlchemyError as e:
        session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        session.close()

@app.route("/delete/<int:activity_id>", methods=["POST"])
@login_required
def delete(activity_id: int):
    session = SessionLocal()
    try:
        obj = session.get(Activity, activity_id)
        if not obj:
            flash("Activity not found", "warning")
        else:
            session.delete(obj)
            session.commit()
            flash("Deleted activity", "success")
    finally:
        session.close()
    return redirect(url_for("index"))


@app.route("/api/activities/<int:activity_id>", methods=["DELETE"])
@login_required
def delete_activity_api(activity_id: int):
    session = SessionLocal()
    try:
        obj = session.get(Activity, activity_id)
        if not obj:
            return jsonify({"ok": False, "error": "not found"}), 404
        user_id = int(current_user.get_id())
        if obj.pet_id is not None:
            allowed = session.scalars(
                select(PetUser).where(PetUser.user_id == user_id, PetUser.pet_id == obj.pet_id)
            ).first()
            if not allowed:
                return jsonify({"ok": False, "error": "forbidden"}), 403
        session.delete(obj)
        session.commit()
        return jsonify({"ok": True})
    except SQLAlchemyError as e:
        session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        session.close()


@app.route("/api/activities", methods=["GET"])
@login_required
def api_list():
    session = SessionLocal()
    try:

        # Limit activities to those belonging to pets the user has access to
        user_id = int(current_user.get_id())
        stmt = select(Activity).options(selectinload(Activity.pet)).join(Pet, Activity.pet_id == Pet.id).join(PetUser, PetUser.pet_id == Pet.id).where(PetUser.user_id == user_id).order_by(desc(Activity.created_at)).limit(5000)
        stmt = apply_filters(stmt, request.args)
        rows = session.execute(stmt).scalars().all()
        return jsonify([{
            "id": a.id,
            "activity_type": a.activity_type,
            "sub_type": a.sub_type,
            "location": a.location,
            "rating": a.rating,
            # amount column removed
            "notes": a.notes,
            "pet_id": a.pet_id,
            "pet_name": a.pet.name if a.pet else None,
            "created_at": (a.created_at.isoformat() if hasattr(a.created_at, "isoformat") else str(a.created_at))
        } for a in rows])
    finally:
        session.close()

@app.route("/api/latest_by_type", methods=["GET"])
@login_required
def api_latest_by_type():
    pet_id = request.args.get("pet_id")
    try:
        pet_id_int = int(pet_id) if pet_id not in (None, "") else None
    except Exception:
        return jsonify({"ok": False, "error": "invalid pet_id"}), 400

    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        # ensure access
        if pet_id_int is not None:
            allowed = session.scalars(select(PetUser).where(PetUser.user_id == user_id, PetUser.pet_id == pet_id_int)).first()
            if not allowed:
                return jsonify({"ok": False, "error": "forbidden"}), 403
        # Helper to get latest
        def latest(filter_exprs):
            q = select(Activity).where(*filter_exprs).order_by(desc(Activity.created_at)).limit(1)
            row = session.execute(q).scalars().first()
            if not row:
                return None
            return {
                "id": row.id,
                "activity_type": row.activity_type,
                "sub_type": row.sub_type,
                "created_at": (row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at))
            }
        base_pet = [Activity.pet_id == pet_id_int] if pet_id_int is not None else []
        resp = {
            "pee": latest(base_pet + [Activity.activity_type == "toilet", Activity.sub_type == "pee"]),
            "poop": latest(base_pet + [Activity.activity_type == "toilet", Activity.sub_type == "poop"]),
            "water": latest(base_pet + [Activity.activity_type == "water"]),
            "food": latest(base_pet + [Activity.activity_type == "food"]),
        }
        return jsonify({"ok": True, "latest": resp})
    finally:
        session.close()

# ----------------------------- Summaries for charts -----------------------------
@app.route("/api/summary/daily_counts", methods=["GET"])
@login_required
def daily_counts():
    session = SessionLocal()
    try:
        # Limit activities to those belonging to pets the user has access to
        user_id = int(current_user.get_id())
        stmt = (
            select(
                func.date_trunc('day', Activity.created_at).label('day'),
                Activity.activity_type,
                Activity.sub_type,
                func.count().label('cnt')
            )
            .join(Pet, Activity.pet_id == Pet.id)
            .join(PetUser, PetUser.pet_id == Pet.id)
            .where(PetUser.user_id == user_id)
        )
        stmt = apply_filters(stmt, request.args)
        stmt = stmt.group_by('day', Activity.activity_type, Activity.sub_type).order_by(asc('day'))
        rows = session.execute(stmt).all()
        data = {}
        activities = set()
        for day, act, sub, cnt in rows:
            day_str = day.date().isoformat()
            # Create series name: "activity_type" or "activity_type - sub_type"
            if sub:
                series_name = f"{act} - {sub}"
            else:
                series_name = act
            data.setdefault(day_str, {})
            data[day_str][series_name] = int(cnt)
            activities.add(series_name)
        return jsonify({"days": sorted(data.keys()), "series": sorted(list(activities)), "values": data})
    finally:
        session.close()

@app.route("/api/summary/potty_speedometer", methods=["GET"])
@login_required
def potty_speedometer():
    """Last poop/pee times: legacy EMA avg_hours plus rest-span estimate in avg_hours_new_method."""
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_id = request.args.get("pet_id")
        summary_tz = os.getenv("SUMMARY_TZ", "America/Los_Angeles")

        # Build base query for user's pets
        base_where = (
            select(Activity.created_at, Activity.sub_type, Activity.trend, Activity.pet_id)
            .join(Pet, Activity.pet_id == Pet.id)
            .join(PetUser, PetUser.pet_id == Pet.id)
            .where(
                and_(
                    PetUser.user_id == user_id,
                    Activity.activity_type == "toilet"
                )
            )
        )

        if pet_id and pet_id != "all":
            try:
                base_where = base_where.where(Activity.pet_id == int(pet_id))
            except ValueError:
                pass

        # Get last toilet events ordered by date (to get most recent trend values)
        stmt = base_where.order_by(desc(Activity.created_at))
        activities = session.execute(stmt).all()

        # Get last event times and most recent trend for each sub_type
        last_poop = None
        last_pee = None
        poop_trend = None
        pee_trend = None

        for created_at, sub_type, trend_val, pet_id_val in activities:
            if sub_type and sub_type.lower() == 'poop':
                if last_poop is None:
                    last_poop = created_at
                if poop_trend is None and trend_val is not None:
                    poop_trend = trend_val
            elif sub_type and sub_type.lower() == 'pee':
                if last_pee is None:
                    last_pee = created_at
                if pee_trend is None and trend_val is not None:
                    pee_trend = trend_val

            # Stop once we have both last times and trends
            if last_poop and last_pee and poop_trend is not None and pee_trend is not None:
                break

        # Biological hold estimate from ~120d of events (single pet only; mixed pets invalid)
        pee_hold_est = None
        poop_hold_est = None
        if pet_id and pet_id != "all":
            try:
                pid = int(pet_id)
                lookback = datetime.now(timezone.utc) - timedelta(days=120)
                hist_stmt = (
                    select(Activity.created_at, Activity.sub_type)
                    .join(Pet, Activity.pet_id == Pet.id)
                    .join(PetUser, PetUser.pet_id == Pet.id)
                    .where(
                        and_(
                            PetUser.user_id == user_id,
                            Activity.activity_type == "toilet",
                            Activity.pet_id == pid,
                            Activity.created_at >= lookback,
                        )
                    )
                    .order_by(asc(Activity.created_at))
                )
                hist_rows = session.execute(hist_stmt).all()
                pee_times, poop_times = split_toilet_times_by_subtype(hist_rows)
                pee_hold_est = estimate_hold_hours(pee_times, summary_tz, is_poop=False)
                poop_hold_est = estimate_hold_hours(poop_times, summary_tz, is_poop=True)
            except ValueError:
                pass

        # Ensure now is timezone-aware UTC
        now = datetime.now(timezone.utc)

        def normalize_to_utc(dt):
            if dt is None:
                return None
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)

        last_poop_utc = normalize_to_utc(last_poop)
        last_pee_utc = normalize_to_utc(last_pee)

        def pee_water_adjusted(base_hours):
            """Shorten expected pee interval when recent water intake was logged."""
            if base_hours is None or last_pee_utc is None:
                return base_hours
            water_query_start = max(last_pee_utc, now - timedelta(hours=12))
            water_where = (
                select(Activity.created_at, Activity.rating, Activity.pet_id)
                .join(Pet, Activity.pet_id == Pet.id)
                .join(PetUser, PetUser.pet_id == Pet.id)
                .where(
                    and_(
                        PetUser.user_id == user_id,
                        Activity.activity_type == "water",
                        Activity.created_at >= water_query_start,
                    )
                )
            )
            if pet_id and pet_id != "all":
                try:
                    water_where = water_where.where(Activity.pet_id == int(pet_id))
                except ValueError:
                    pass
            water_activities = session.execute(water_where.order_by(desc(Activity.created_at))).all()
            if not water_activities:
                return base_hours
            total_reduction_factor = 0.0
            for water_created_at, water_rating, _water_pet_id in water_activities:
                if water_created_at.tzinfo is None:
                    water_time = water_created_at.replace(tzinfo=timezone.utc)
                else:
                    water_time = water_created_at.astimezone(timezone.utc)
                if water_time > last_pee_utc:
                    hours_since_water = (now - water_time).total_seconds() / 3600.0
                    water_rating_val = water_rating or 4
                    if water_rating_val <= 2:
                        rating_factor = 0.3
                    elif water_rating_val <= 4:
                        rating_factor = 0.6
                    else:
                        rating_factor = 1.0
                    time_factor = max(0, 1.0 - max(0, hours_since_water - 3) / 3.0)
                    reduction = rating_factor * time_factor * 0.20
                    total_reduction_factor += reduction
            total_reduction_factor = min(total_reduction_factor, 0.30)
            return base_hours * (1.0 - total_reduction_factor)

        adjusted_pee_legacy = pee_water_adjusted(pee_trend)
        adjusted_pee_new = pee_water_adjusted(pee_hold_est) if pee_hold_est is not None else None

        result = {
            "poop": {
                "last_time": last_poop.isoformat() if last_poop else None,
                "hours_since": round((now - last_poop_utc).total_seconds() / 3600.0, 1) if last_poop_utc else None,
                "avg_hours": round(poop_trend, 1) if poop_trend is not None else None,
                "avg_hours_new_method": round(poop_hold_est, 1) if poop_hold_est is not None else None,
            },
            "pee": {
                "last_time": last_pee.isoformat() if last_pee else None,
                "hours_since": round((now - last_pee_utc).total_seconds() / 3600.0, 1) if last_pee_utc else None,
                "avg_hours": round(adjusted_pee_legacy, 1) if adjusted_pee_legacy is not None else None,
                "avg_hours_new_method": round(adjusted_pee_new, 1) if adjusted_pee_new is not None else None,
            },
        }
        
        return jsonify(result)
    finally:
        session.close()

@app.route("/api/summary/potty_hold_time", methods=["GET"])
@login_required
def potty_hold_time():
    """Daily poop/pee hold metrics: smoothed trend plus actual min/max gap (hours) between events."""
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_id = request.args.get("pet_id")
        
        # Build base query for user's pets, including trend
        base_where = (
            select(Activity.created_at, Activity.sub_type, Activity.trend, Activity.pet_id)
            .join(Pet, Activity.pet_id == Pet.id)
            .join(PetUser, PetUser.pet_id == Pet.id)
            .where(
                and_(
                    PetUser.user_id == user_id,
                    Activity.activity_type == "toilet"
                )
            )
        )
        
        if pet_id and pet_id != "all":
            try:
                base_where = base_where.where(Activity.pet_id == int(pet_id))
            except ValueError:
                pass
        
        # Apply date filters if provided
        start_date = request.args.get("start")
        end_date = request.args.get("end")
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                if start_dt.tzinfo is None:
                    start_dt = start_dt.replace(tzinfo=timezone.utc)
                base_where = base_where.where(Activity.created_at >= start_dt)
            except (ValueError, AttributeError):
                pass
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                if end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=timezone.utc)
                base_where = base_where.where(Activity.created_at <= end_dt)
            except (ValueError, AttributeError):
                pass
        
        # Default to last 30 days if no date range specified
        if not start_date and not end_date:
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            base_where = base_where.where(Activity.created_at >= thirty_days_ago)
        
        stmt = base_where.order_by(asc(Activity.created_at))
        activities = session.execute(stmt).all()
        
        poop_trend_by_day = {}
        pee_trend_by_day = {}
        poop_intervals_by_day = defaultdict(list)
        pee_intervals_by_day = defaultdict(list)
        last_ts = {}  # (pet_id, 'poop'|'pee') -> datetime
        
        for created_at, sub_type, trend_val, pet_id_val in activities:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            else:
                created_at = created_at.astimezone(timezone.utc)
            
            st = (sub_type or "").lower()
            if st not in ("poop", "pee"):
                continue
            
            day_str = created_at.date().isoformat()
            key = (pet_id_val, st)
            prev = last_ts.get(key)
            if prev is not None:
                delta_h = (created_at - prev).total_seconds() / 3600.0
                if st == "poop":
                    poop_intervals_by_day[day_str].append(delta_h)
                else:
                    pee_intervals_by_day[day_str].append(delta_h)
            last_ts[key] = created_at
            
            if trend_val is not None:
                if st == "poop":
                    poop_trend_by_day[day_str] = trend_val
                else:
                    pee_trend_by_day[day_str] = trend_val
        
        all_days = sorted(set(
            list(poop_trend_by_day.keys())
            + list(pee_trend_by_day.keys())
            + list(poop_intervals_by_day.keys())
            + list(pee_intervals_by_day.keys())
        ))
        
        def series_for(trend_map, intervals_map):
            trends = []
            mins = []
            maxs = []
            for d in all_days:
                trends.append(trend_map.get(d))
                ivs = intervals_map.get(d, [])
                if ivs:
                    mins.append(min(ivs))
                    maxs.append(max(ivs))
                else:
                    mins.append(None)
                    maxs.append(None)
            return trends, mins, maxs
        
        pt, pmin, pmax = series_for(poop_trend_by_day, poop_intervals_by_day)
        et, emin, emax = series_for(pee_trend_by_day, pee_intervals_by_day)
        
        return jsonify({
            "days": all_days,
            "poop": {"trend": pt, "min": pmin, "max": pmax},
            "pee": {"trend": et, "min": emin, "max": emax},
        })
    finally:
        session.close()

@app.route("/api/summary/potty_location", methods=["GET"])
@login_required
def potty_location():
    """Get counts of inside vs outside potty events over time (daily data points)"""
    session = SessionLocal()
    try:
        user_id = int(current_user.get_id())
        pet_id = request.args.get("pet_id")
        
        # Build base query for user's pets, toilet activities only
        base_where = (
            select(
                func.date_trunc('day', Activity.created_at).label('day'),
                Activity.location,
                func.count().label('cnt')
            )
            .join(Pet, Activity.pet_id == Pet.id)
            .join(PetUser, PetUser.pet_id == Pet.id)
            .where(
                and_(
                    PetUser.user_id == user_id,
                    Activity.activity_type == "toilet"
                )
            )
        )
        
        if pet_id and pet_id != "all":
            try:
                base_where = base_where.where(Activity.pet_id == int(pet_id))
            except ValueError:
                pass
        
        # Apply date filters if provided
        start_date = request.args.get("start")
        end_date = request.args.get("end")
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                if start_dt.tzinfo is None:
                    start_dt = start_dt.replace(tzinfo=timezone.utc)
                base_where = base_where.where(Activity.created_at >= start_dt)
            except (ValueError, AttributeError):
                pass
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                if end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=timezone.utc)
                base_where = base_where.where(Activity.created_at <= end_dt)
            except (ValueError, AttributeError):
                pass
        
        # Default to last 30 days if no date range specified
        if not start_date and not end_date:
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            base_where = base_where.where(Activity.created_at >= thirty_days_ago)
        
        stmt = base_where.group_by('day', Activity.location).order_by(asc('day'))
        rows = session.execute(stmt).all()
        
        # Organize data by day and location
        data = {}
        for day, location, cnt in rows:
            day_str = day.date().isoformat()
            data.setdefault(day_str, {})
            # Normalize location (handle None, empty string, or case variations)
            loc_key = (location or 'unknown').lower() if location else 'unknown'
            data[day_str][loc_key] = data[day_str].get(loc_key, 0) + int(cnt)
        
        # Get all unique days and sort
        all_days = sorted(data.keys())
        
        # Build arrays for inside and outside counts
        inside_counts = []
        outside_counts = []
        for day in all_days:
            day_data = data[day]
            inside_counts.append(day_data.get('inside', 0))
            outside_counts.append(day_data.get('outside', 0))
        
        return jsonify({
            "days": all_days,
            "inside": inside_counts,
            "outside": outside_counts
        })
    finally:
        session.close()

# ----------------------------- CSV Export -----------------------------
@app.route("/export.csv", methods=["GET"])
@app.route("/api/export.csv", methods=["GET"])
@login_required
def export_csv():
    session = SessionLocal()
    try:
        stmt = select(Activity).order_by(asc(Activity.created_at))
        stmt = apply_filters(stmt, request.args)
        rows = session.execute(stmt).scalars().all()

        si = StringIO()
        writer = csv.writer(si)
        writer.writerow(["id", "created_at", "pet", "pet_id", "activity_type", "sub_type", "location", "rating", "notes"])
        for a in rows:
            writer.writerow([
                a.id,
                (a.created_at.isoformat() if hasattr(a.created_at, "isoformat") else str(a.created_at)),
                a.pet.name if a.pet else "",
                a.pet_id or "",
                a.activity_type,
                a.sub_type or "",
                a.location or "",
                a.rating or "",
                a.notes or "",
            ])
        output = si.getvalue()
        return Response(output, mimetype="text/csv", headers={
            "Content-Disposition": "attachment; filename=pet-activities.csv"
        })
    finally:
        session.close()

# ----------------------------- Printable Report -----------------------------
@app.route("/report", methods=["GET"])
@login_required
def report():
    session = SessionLocal()
    try:
        pets = session.scalars(select(Pet).order_by(asc(Pet.name))).all()
        stmt = (
            select(Activity)
            .options(selectinload(Activity.pet))
            .order_by(asc(Activity.created_at))
        )
        stmt = apply_filters(stmt, request.args)
        rows = session.execute(stmt).scalars().all()

        grouped = {}
        for a in rows:
            # Use local date for grouping (database returns naive UTC, assume UTC and convert to local)
            if hasattr(a.created_at, "date"):
                # Database returns naive datetime, assume it's UTC
                dt_utc = a.created_at.replace(tzinfo=timezone.utc)
                local_dt = dt_utc.astimezone()
                day = local_dt.date().isoformat()
            else:
                day = str(a.created_at)[:10]
            grouped.setdefault(day, {})
            pet_name = a.pet.name if a.pet else "Unassigned"
            grouped[day].setdefault(pet_name, [])
            grouped[day][pet_name].append(a)

        return render_template("report.html", grouped=grouped, filters=request.args, pets=pets)
    finally:
        session.close()


def _activity_json(a):
    return {
        "id": a.id,
        "created_at": a.created_at.isoformat() if hasattr(a.created_at, "isoformat") else str(a.created_at),
        "activity_type": a.activity_type,
        "sub_type": a.sub_type,
        "location": a.location,
        "rating": a.rating,
        "notes": a.notes,
        "pet_id": a.pet_id,
        "pet_name": a.pet.name if a.pet else None,
    }


@app.route("/api/report", methods=["GET"])
@login_required
def api_report():
    session = SessionLocal()
    try:
        pets = session.scalars(select(Pet).order_by(asc(Pet.name))).all()
        stmt = select(Activity).options(selectinload(Activity.pet)).order_by(asc(Activity.created_at))
        stmt = apply_filters(stmt, request.args)
        rows = session.execute(stmt).scalars().all()
        grouped = {}
        for a in rows:
            if hasattr(a.created_at, "date"):
                dt_utc = a.created_at.replace(tzinfo=timezone.utc)
                local_dt = dt_utc.astimezone()
                day = local_dt.date().isoformat()
            else:
                day = str(a.created_at)[:10]
            grouped.setdefault(day, {})
            pet_name = a.pet.name if a.pet else "Unassigned"
            grouped[day].setdefault(pet_name, [])
            grouped[day][pet_name].append(_activity_json(a))
        return jsonify(
            {
                "grouped": grouped,
                "pets": [{"id": p.id, "name": p.name} for p in pets],
            }
        )
    finally:
        session.close()


# ----------------------------- Manual weekly summary trigger -----------------------------
@app.route("/summary/weekly", methods=["GET"])
@login_required
def summary_weekly_preview():
    # optional params: start, end
    start = request.args.get("start")
    end = request.args.get("end")
    def parse_dt(s):
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None
    from datetime import timedelta
    now = datetime.utcnow()
    start_dt = parse_dt(start) or (now - timedelta(days=7))
    end_dt = parse_dt(end) or now
    text = build_weekly_summary_text(start_dt, end_dt)
    if request.args.get("send") == "1":
        send_email("Weekly Pet Activity Summary (manual)", text)
        flash("Weekly summary sent (if email is configured).", "success")
        return redirect(url_for("index"))
    return Response(text, mimetype="text/plain")

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)