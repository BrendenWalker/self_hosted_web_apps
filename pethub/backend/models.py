from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Text, TIMESTAMP, func, ForeignKey, Boolean, TypeDecorator, Date, Float
from sqlalchemy.dialects.postgresql import TIMESTAMP as PG_TIMESTAMP
from datetime import datetime, timezone
from typing import List, Optional

class Base(DeclarativeBase):
    pass

class UTCTimestamp(TypeDecorator):
    """Ensures datetime is stored as UTC in PostgreSQL"""
    impl = PG_TIMESTAMP(timezone=True)
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        # If naive, assume UTC
        if isinstance(value, datetime) and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        # If timezone-aware, convert to UTC
        elif isinstance(value, datetime) and value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Ensure returned value is UTC
        if isinstance(value, datetime):
            if value.tzinfo is None:
                # If naive, assume it's UTC
                return value.replace(tzinfo=timezone.utc)
            else:
                # Convert to UTC
                return value.astimezone(timezone.utc)
        return value

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    # Persistent default pet for the user (optional)
    default_pet_id: Mapped[Optional[int]] = mapped_column(ForeignKey("pets.id", ondelete="SET NULL"), nullable=True)
    default_pet: Mapped[Optional["Pet"]] = relationship("Pet", foreign_keys=[default_pet_id], lazy="selectin")
    # pet memberships (which pets this user has access to)
    pet_memberships: Mapped[List["PetUser"]] = relationship("PetUser", back_populates="user", cascade="all, delete-orphan", lazy="selectin")

class Pet(Base):
    __tablename__ = "pets"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    birthdate: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)

    activities: Mapped[List["Activity"]] = relationship(back_populates="pet", cascade="all, delete-orphan", lazy="selectin")
    # users associated with this pet (access control)
    users: Mapped[List["PetUser"]] = relationship("PetUser", back_populates="pet", cascade="all, delete-orphan", lazy="selectin")

class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    sub_type: Mapped[Optional[str]] = mapped_column(String(50))
    location: Mapped[Optional[str]] = mapped_column(String(10))  # inside/outside for potty
    rating: Mapped[Optional[int]] = mapped_column(Integer)       # 1-7 scale for activities like potty/water
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCTimestamp, server_default=func.now(), nullable=False)
    trend: Mapped[Optional[float]] = mapped_column(Float, nullable=True)     # Smoothed interval between toilet events (hours)
    variance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Difference between actual interval and trend

    pet_id: Mapped[Optional[int]] = mapped_column(ForeignKey("pets.id", ondelete="SET NULL"))
    pet: Mapped[Optional[Pet]] = relationship(back_populates="activities", lazy="selectin")


class PetUser(Base):
    __tablename__ = "pet_users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pet_id: Mapped[int] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    is_manager: Mapped[bool] = mapped_column(Boolean, default=False)
    pet: Mapped[Pet] = relationship("Pet", back_populates="users", lazy="selectin")
    user: Mapped[User] = relationship("User", back_populates="pet_memberships", lazy="selectin")


class PetInvitation(Base):
    __tablename__ = "pet_invitations"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pet_id: Mapped[int] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"))
    invite_email: Mapped[str] = mapped_column(String(255), nullable=False)
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCTimestamp, server_default=func.now(), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(UTCTimestamp, nullable=True)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    used_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    pet: Mapped[Pet] = relationship("Pet", lazy="selectin")


class Setting(Base):
    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCTimestamp, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCTimestamp, server_default=func.now(), onupdate=func.now(), nullable=False)
