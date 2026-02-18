-- PostgreSQL Schema for Vehicle Service Tracking System
-- Migrated from Firebird

-- Service Type table
CREATE TABLE IF NOT EXISTS servicetype (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle table
CREATE TABLE IF NOT EXISTS vehicle (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service Intervals table (defines when services are due)
CREATE TABLE IF NOT EXISTS service_intervals (
    vehicleid INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
    serviceid INTEGER NOT NULL REFERENCES servicetype(id) ON DELETE CASCADE,
    months INTEGER,
    miles INTEGER,
    notes TEXT,
    nextdate DATE,
    nextmiles INTEGER,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (vehicleid, serviceid)
);

CREATE INDEX IF NOT EXISTS idx_service_intervals_vehicleid ON service_intervals(vehicleid);
CREATE INDEX IF NOT EXISTS idx_service_intervals_serviceid ON service_intervals(serviceid);
CREATE INDEX IF NOT EXISTS idx_service_intervals_nextdate ON service_intervals(nextdate);

-- Service Log table (history of performed services)
CREATE TABLE IF NOT EXISTS service_log (
    id SERIAL PRIMARY KEY,
    vehicleid INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
    serviceid INTEGER NOT NULL REFERENCES servicetype(id) ON DELETE CASCADE,
    servicedate DATE NOT NULL,
    servicemiles INTEGER,
    notes VARCHAR(255),
    qty DECIMAL(10, 2), -- For gallons/quantity tracking
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_log_vehicleid ON service_log(vehicleid);
CREATE INDEX IF NOT EXISTS idx_service_log_serviceid ON service_log(serviceid);
CREATE INDEX IF NOT EXISTS idx_service_log_servicedate ON service_log(servicedate);

-- Function to update next service date/miles after a service is logged
CREATE OR REPLACE FUNCTION update_next_service()
RETURNS TRIGGER AS $$
DECLARE
    v_months INTEGER;
    v_miles INTEGER;
    v_nextdate DATE;
    v_nextmiles INTEGER;
BEGIN
    -- Get the service interval settings for this vehicle/service
    SELECT months, miles INTO v_months, v_miles
    FROM service_intervals
    WHERE vehicleid = NEW.vehicleid AND serviceid = NEW.serviceid;
    
    -- Calculate next service date and miles
    IF v_months IS NOT NULL THEN
        v_nextdate := NEW.servicedate + (v_months || ' months')::INTERVAL;
    END IF;
    
    IF v_miles IS NOT NULL AND NEW.servicemiles IS NOT NULL THEN
        v_nextmiles := NEW.servicemiles + v_miles;
    END IF;
    
    -- Update the service_intervals table
    UPDATE service_intervals
    SET nextdate = v_nextdate,
        nextmiles = v_nextmiles,
        modified = CURRENT_TIMESTAMP
    WHERE vehicleid = NEW.vehicleid AND serviceid = NEW.serviceid;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update next service after logging a service
CREATE TRIGGER service_log_update_next_service
AFTER INSERT OR UPDATE ON service_log
FOR EACH ROW
EXECUTE FUNCTION update_next_service();
