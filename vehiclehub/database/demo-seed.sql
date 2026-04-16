BEGIN;

-- Service types
INSERT INTO servicetype (name) VALUES
  ('Oil Change'),
  ('Tire Rotation'),
  ('Brake Inspection'),
  ('Engine Air Filter'),
  ('Cabin Air Filter'),
  ('Transmission Fluid'),
  ('Coolant Flush'),
  ('Fuel Fill-up')
ON CONFLICT (name) DO NOTHING;

-- Vehicles
INSERT INTO vehicle (name) VALUES
  ('2019 Honda CR-V'),
  ('2021 Toyota Tacoma')
ON CONFLICT (name) DO NOTHING;

-- Interval definitions
INSERT INTO service_intervals (vehicleid, serviceid, months, miles, notes)
SELECT v.id, s.id, x.months, x.miles, x.notes
FROM (
  VALUES
    ('2019 Honda CR-V', 'Oil Change', 6, 5000, 'Full synthetic'),
    ('2019 Honda CR-V', 'Tire Rotation', 6, 6000, 'Rotate with oil service'),
    ('2019 Honda CR-V', 'Brake Inspection', 12, 12000, 'Inspect pads and rotors'),
    ('2019 Honda CR-V', 'Cabin Air Filter', 12, 15000, 'Replace before allergy season'),
    ('2021 Toyota Tacoma', 'Oil Change', 6, 6000, '0W-20 synthetic'),
    ('2021 Toyota Tacoma', 'Tire Rotation', 6, 6000, '5 tire pattern'),
    ('2021 Toyota Tacoma', 'Engine Air Filter', 12, 15000, 'Dusty roads use-case'),
    ('2021 Toyota Tacoma', 'Transmission Fluid', 24, 30000, 'Inspect color and level'),
    ('2021 Toyota Tacoma', 'Fuel Fill-up', 0, 450, 'Mileage tracker')
) AS x(vehicle_name, service_name, months, miles, notes)
JOIN vehicle v ON v.name = x.vehicle_name
JOIN servicetype s ON s.name = x.service_name
ON CONFLICT (vehicleid, serviceid) DO UPDATE
SET months = EXCLUDED.months,
    miles = EXCLUDED.miles,
    notes = EXCLUDED.notes,
    modified = CURRENT_TIMESTAMP;

-- Service history logs (trigger auto-populates next service targets)
INSERT INTO service_log (vehicleid, serviceid, servicedate, servicemiles, notes, qty)
SELECT v.id, s.id, x.servicedate, x.servicemiles, x.notes, x.qty
FROM (
  VALUES
    ('2019 Honda CR-V', 'Oil Change', CURRENT_DATE - INTERVAL '150 days', 43210, 'Oil + filter', NULL),
    ('2019 Honda CR-V', 'Tire Rotation', CURRENT_DATE - INTERVAL '150 days', 43210, 'Cross pattern', NULL),
    ('2019 Honda CR-V', 'Brake Inspection', CURRENT_DATE - INTERVAL '320 days', 39800, 'Front pads 7mm', NULL),
    ('2019 Honda CR-V', 'Cabin Air Filter', CURRENT_DATE - INTERVAL '365 days', 39200, 'Replaced with HEPA style', NULL),
    ('2021 Toyota Tacoma', 'Oil Change', CURRENT_DATE - INTERVAL '120 days', 28150, 'Dealer service', NULL),
    ('2021 Toyota Tacoma', 'Tire Rotation', CURRENT_DATE - INTERVAL '120 days', 28150, 'Balanced all tires', NULL),
    ('2021 Toyota Tacoma', 'Engine Air Filter', CURRENT_DATE - INTERVAL '250 days', 24400, 'Replaced due to dust', NULL),
    ('2021 Toyota Tacoma', 'Transmission Fluid', CURRENT_DATE - INTERVAL '420 days', 19000, 'Drain/fill', NULL),
    ('2021 Toyota Tacoma', 'Fuel Fill-up', CURRENT_DATE - INTERVAL '14 days', 30120, 'Regular unleaded', 16.40),
    ('2021 Toyota Tacoma', 'Fuel Fill-up', CURRENT_DATE - INTERVAL '7 days', 30495, 'Regular unleaded', 15.85),
    ('2021 Toyota Tacoma', 'Fuel Fill-up', CURRENT_DATE - INTERVAL '1 days', 30920, 'Regular unleaded', 17.10)
) AS x(vehicle_name, service_name, servicedate, servicemiles, notes, qty)
JOIN vehicle v ON v.name = x.vehicle_name
JOIN servicetype s ON s.name = x.service_name
WHERE NOT EXISTS (
  SELECT 1
  FROM service_log l
  WHERE l.vehicleid = v.id
    AND l.serviceid = s.id
    AND l.servicedate = x.servicedate::date
    AND l.servicemiles IS NOT DISTINCT FROM x.servicemiles
);

-- Ensure due dates and due mileage are in sync after inserts.
SELECT recalculate_all_service_intervals();

COMMIT;
