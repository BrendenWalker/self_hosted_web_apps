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
    
    -- Only update if interval settings exist
    IF v_months IS NOT NULL OR v_miles IS NOT NULL THEN
        -- Calculate next service date and miles based on the logged service
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
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate next service from most recent log entry (for deletions)
CREATE OR REPLACE FUNCTION recalculate_next_service_after_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_months INTEGER;
    v_miles INTEGER;
    v_nextdate DATE;
    v_nextmiles INTEGER;
    v_latest_log RECORD;
BEGIN
    -- Get the service interval settings for this vehicle/service
    SELECT months, miles INTO v_months, v_miles
    FROM service_intervals
    WHERE vehicleid = OLD.vehicleid AND serviceid = OLD.serviceid;
    
    -- Only recalculate if interval settings exist
    IF v_months IS NOT NULL OR v_miles IS NOT NULL THEN
        -- Find the most recent service log entry for this vehicle/service
        SELECT servicedate, servicemiles INTO v_latest_log
        FROM service_log
        WHERE vehicleid = OLD.vehicleid AND serviceid = OLD.serviceid
        ORDER BY servicedate DESC, servicemiles DESC NULLS LAST
        LIMIT 1;
        
        -- If there's a previous log entry, calculate from it
        IF v_latest_log.servicedate IS NOT NULL THEN
            IF v_months IS NOT NULL THEN
                v_nextdate := v_latest_log.servicedate + (v_months || ' months')::INTERVAL;
            ELSE
                v_nextdate := NULL;
            END IF;
            
            IF v_miles IS NOT NULL AND v_latest_log.servicemiles IS NOT NULL THEN
                v_nextmiles := v_latest_log.servicemiles + v_miles;
            ELSE
                v_nextmiles := NULL;
            END IF;
        ELSE
            -- No previous log entries, clear nextdate and nextmiles
            v_nextdate := NULL;
            v_nextmiles := NULL;
        END IF;
        
        -- Update the service_intervals table
        UPDATE service_intervals
        SET nextdate = v_nextdate,
            nextmiles = v_nextmiles,
            modified = CURRENT_TIMESTAMP
        WHERE vehicleid = OLD.vehicleid AND serviceid = OLD.serviceid;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update next service after logging a service
CREATE TRIGGER service_log_update_next_service
AFTER INSERT OR UPDATE ON service_log
FOR EACH ROW
EXECUTE FUNCTION update_next_service();

-- Trigger to recalculate next service after deleting a service log entry
CREATE TRIGGER service_log_recalculate_after_delete
AFTER DELETE ON service_log
FOR EACH ROW
EXECUTE FUNCTION recalculate_next_service_after_delete();

-- Function to recalculate all service intervals from service log history
CREATE OR REPLACE FUNCTION recalculate_all_service_intervals()
RETURNS void AS $$
DECLARE
    v_interval RECORD;
    v_latest_log RECORD;
    v_nextdate DATE;
    v_nextmiles INTEGER;
BEGIN
    -- Loop through all service intervals
    FOR v_interval IN 
        SELECT vehicleid, serviceid, months, miles
        FROM service_intervals
    LOOP
        -- Find the most recent service log entry for this vehicle/service
        SELECT servicedate, servicemiles INTO v_latest_log
        FROM service_log
        WHERE vehicleid = v_interval.vehicleid AND serviceid = v_interval.serviceid
        ORDER BY servicedate DESC, servicemiles DESC NULLS LAST
        LIMIT 1;
        
        -- Calculate next service date and miles from most recent log entry
        IF v_latest_log.servicedate IS NOT NULL THEN
            IF v_interval.months IS NOT NULL THEN
                v_nextdate := v_latest_log.servicedate + (v_interval.months || ' months')::INTERVAL;
            ELSE
                v_nextdate := NULL;
            END IF;
            
            IF v_interval.miles IS NOT NULL AND v_latest_log.servicemiles IS NOT NULL THEN
                v_nextmiles := v_latest_log.servicemiles + v_interval.miles;
            ELSE
                v_nextmiles := NULL;
            END IF;
        ELSE
            -- No log entries, clear nextdate and nextmiles
            v_nextdate := NULL;
            v_nextmiles := NULL;
        END IF;
        
        -- Update the service_intervals table
        UPDATE service_intervals
        SET nextdate = v_nextdate,
            nextmiles = v_nextmiles,
            modified = CURRENT_TIMESTAMP
        WHERE vehicleid = v_interval.vehicleid AND serviceid = v_interval.serviceid;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
