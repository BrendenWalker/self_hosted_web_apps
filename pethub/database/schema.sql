-- PetHub baseline schema (PostgreSQL).
-- Existing deployments typically use Alembic in pethub/backend; this file documents the model for fresh installs.

CREATE TABLE IF NOT EXISTS pets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    birthdate DATE,
    adult_food_transition_start DATE,
    daily_food_cups NUMERIC(5, 2)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    default_pet_id INTEGER REFERENCES pets (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL,
    sub_type VARCHAR(50),
    location VARCHAR(10),
    rating INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    trend DOUBLE PRECISION,
    variance DOUBLE PRECISION,
    pet_id INTEGER REFERENCES pets (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pet_users (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER NOT NULL REFERENCES pets (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    is_manager BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pet_users_pet_user ON pet_users (pet_id, user_id);

CREATE TABLE IF NOT EXISTS pet_invitations (
    id SERIAL PRIMARY KEY,
    pet_id INTEGER NOT NULL REFERENCES pets (id) ON DELETE CASCADE,
    invite_email VARCHAR(255) NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    used_by_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
