-- One-time migration: remove the "All" store and any storezones referencing store id -1.
-- The app now uses a synthetic "All" store (id -1) with no DB row; all departments
-- are shown in the General zone without storezones entries.
-- Run once: psql -U postgres -d <yourdb> -f kitchenhub/database/migrations/001-remove-all-store.sql

-- Remove zone rows that reference the synthetic store id -1 (no such store row should exist).
DELETE FROM storezones WHERE storeid = -1;

-- Remove store row with id -1 if it was ever created.
DELETE FROM store WHERE id = -1;

-- Remove any store named "All" (storezones for that store are removed by ON DELETE CASCADE).
DELETE FROM store WHERE name = 'All';
