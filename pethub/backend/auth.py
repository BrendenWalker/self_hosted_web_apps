import os
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user, UserMixin
from sqlalchemy import select, func
from werkzeug.security import generate_password_hash, check_password_hash

from db import SessionLocal
from models import User

login_manager = LoginManager()
login_manager.login_view = "auth.login"

class UserWrapper(UserMixin):
    def __init__(self, user):
        self.user = user
    def get_id(self):
        return str(self.user.id)
    @property
    def is_active(self):
        return self.user.is_active

@login_manager.user_loader
def load_user(user_id):
    session = SessionLocal()
    try:
        u = session.get(User, int(user_id))
        return UserWrapper(u) if u else None
    finally:
        session.close()

bp = Blueprint("auth", __name__, url_prefix="/auth")

@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        session = SessionLocal()
        try:
            u = session.scalars(select(User).where(func.lower(User.email) == email)).first()
            if u and check_password_hash(u.password_hash, password):
                login_user(UserWrapper(u))
                flash("Logged in!", "success")
                return redirect(url_for("index"))
            flash("Invalid email or password", "danger")
        finally:
            session.close()
    return render_template("login.html")

@bp.route("/signup", methods=["GET", "POST"])
def signup():
    if os.getenv("ALLOW_SIGNUP", "1") != "1":
        flash("Signup disabled", "warning")
        return redirect(url_for("auth.login"))
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        if not email or not password:
            flash("Email and password are required", "danger")
            return redirect(url_for("auth.signup"))
        session = SessionLocal()
        try:
            existing = session.scalars(select(User).where(func.lower(User.email) == email)).first()
            if existing:
                flash("Email already registered", "warning")
                return redirect(url_for("auth.login"))
            # Create user
            u = User(email=email, password_hash=generate_password_hash(password))
            session.add(u)
            session.commit()
            flash("Account created. Please login.", "success")
            return redirect(url_for("auth.login"))
        finally:
            session.close()
    return render_template("signup.html")

@bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Logged out.", "success")
    return redirect(url_for("auth.login"))