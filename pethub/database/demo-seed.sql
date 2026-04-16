BEGIN;

-- Pets
INSERT INTO pets (name, birthdate) VALUES
  ('Luna', '2020-05-14'),
  ('Max', '2018-11-02'),
  ('Poppy', '2022-03-21')
ON CONFLICT DO NOTHING;

-- Users
INSERT INTO users (email, password_hash, is_active, is_admin, default_pet_id)
SELECT 'owner@example.com', '$2b$12$demo.owner.hash.value', true, true, p.id
FROM pets p
WHERE p.name = 'Luna'
ON CONFLICT (email) DO UPDATE
SET is_active = EXCLUDED.is_active,
    is_admin = EXCLUDED.is_admin,
    default_pet_id = EXCLUDED.default_pet_id;

INSERT INTO users (email, password_hash, is_active, is_admin, default_pet_id)
SELECT 'family@example.com', '$2b$12$demo.family.hash.value', true, false, p.id
FROM pets p
WHERE p.name = 'Max'
ON CONFLICT (email) DO UPDATE
SET is_active = EXCLUDED.is_active,
    is_admin = EXCLUDED.is_admin,
    default_pet_id = EXCLUDED.default_pet_id;

INSERT INTO users (email, password_hash, is_active, is_admin, default_pet_id)
SELECT 'walker@example.com', '$2b$12$demo.walker.hash.value', true, false, p.id
FROM pets p
WHERE p.name = 'Poppy'
ON CONFLICT (email) DO UPDATE
SET is_active = EXCLUDED.is_active,
    is_admin = EXCLUDED.is_admin,
    default_pet_id = EXCLUDED.default_pet_id;

-- Pet/user relationships
INSERT INTO pet_users (pet_id, user_id, is_manager)
SELECT p.id, u.id, true
FROM pets p
JOIN users u ON u.email = 'owner@example.com'
WHERE p.name IN ('Luna', 'Max', 'Poppy')
ON CONFLICT (pet_id, user_id) DO UPDATE SET is_manager = EXCLUDED.is_manager;

INSERT INTO pet_users (pet_id, user_id, is_manager)
SELECT p.id, u.id, false
FROM pets p
JOIN users u ON u.email = 'family@example.com'
WHERE p.name IN ('Luna', 'Max')
ON CONFLICT (pet_id, user_id) DO UPDATE SET is_manager = EXCLUDED.is_manager;

INSERT INTO pet_users (pet_id, user_id, is_manager)
SELECT p.id, u.id, false
FROM pets p
JOIN users u ON u.email = 'walker@example.com'
WHERE p.name = 'Poppy'
ON CONFLICT (pet_id, user_id) DO UPDATE SET is_manager = EXCLUDED.is_manager;

-- Activities
INSERT INTO activities (activity_type, sub_type, location, rating, notes, created_at, trend, variance, pet_id)
SELECT x.activity_type, x.sub_type, x.location, x.rating, x.notes, x.created_at, x.trend, x.variance, p.id
FROM (
  VALUES
    ('Walk', 'Neighborhood', 'OUT', 5, 'Energetic 35-minute walk', now() - interval '1 day', 0.9, 0.1, 'Luna'),
    ('Meal', 'Dry Food', 'IN', 4, 'Ate full portion', now() - interval '1 day' + interval '2 hours', 0.4, 0.2, 'Luna'),
    ('Vet', 'Annual Checkup', 'OUT', 5, 'All vitals normal', now() - interval '14 days', 0.8, 0.1, 'Max'),
    ('Play', 'Fetch', 'OUT', 5, 'Loved park session', now() - interval '2 days', 1.0, 0.0, 'Max'),
    ('Walk', 'Trail', 'OUT', 4, 'Short due to rain', now() - interval '3 days', 0.3, 0.5, 'Poppy'),
    ('Grooming', 'Bath', 'IN', 3, 'Tolerated well', now() - interval '7 days', 0.2, 0.4, 'Poppy')
) AS x(activity_type, sub_type, location, rating, notes, created_at, trend, variance, pet_name)
JOIN pets p ON p.name = x.pet_name
WHERE NOT EXISTS (
  SELECT 1
  FROM activities a
  WHERE a.pet_id = p.id
    AND a.activity_type = x.activity_type
    AND a.sub_type IS NOT DISTINCT FROM x.sub_type
    AND a.created_at::date = x.created_at::date
);

-- Invitations
INSERT INTO pet_invitations (pet_id, invite_email, token, created_at, expires_at, accepted, used_by_user_id)
SELECT p.id, 'newfriend@example.com', 'demo-invite-token-pethub-001', now() - interval '2 days', now() + interval '5 days', false, NULL
FROM pets p
WHERE p.name = 'Luna'
ON CONFLICT (token) DO NOTHING;

INSERT INTO pet_invitations (pet_id, invite_email, token, created_at, expires_at, accepted, used_by_user_id)
SELECT p.id, 'family@example.com', 'demo-invite-token-pethub-accepted', now() - interval '20 days', now() - interval '10 days', true, u.id
FROM pets p
JOIN users u ON u.email = 'family@example.com'
WHERE p.name = 'Max'
ON CONFLICT (token) DO NOTHING;

-- App settings
INSERT INTO settings (key, value) VALUES
  ('app_name', 'PetHub Demo'),
  ('default_activity_view_days', '30'),
  ('show_trend_chart', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

COMMIT;
