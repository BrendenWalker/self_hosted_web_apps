-- Apply after upgrading VehicleHub when upcoming services stay stale after logging.
-- Safe to re-run (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION recalculate_service_interval(p_vehicleid INTEGER, p_serviceid INTEGER)
RETURNS void AS $$
DECLARE
    v_months INTEGER;
    v_miles INTEGER;
    v_nextdate DATE;
    v_nextmiles INTEGER;
    v_latest_log RECORD;
BEGIN
    SELECT months, miles INTO v_months, v_miles
    FROM service_intervals
    WHERE vehicleid = p_vehicleid AND serviceid = p_serviceid;

    IF NOT FOUND OR (v_months IS NULL AND v_miles IS NULL) THEN
        RETURN;
    END IF;

    v_nextdate := NULL;
    v_nextmiles := NULL;

    SELECT servicedate, servicemiles INTO v_latest_log
    FROM service_log
    WHERE vehicleid = p_vehicleid AND serviceid = p_serviceid
    ORDER BY servicedate DESC, servicemiles DESC NULLS LAST, id DESC
    LIMIT 1;

    IF FOUND AND v_latest_log.servicedate IS NOT NULL THEN
        IF v_months IS NOT NULL AND v_months > 0 THEN
            v_nextdate := v_latest_log.servicedate + (v_months || ' months')::INTERVAL;
        END IF;

        IF v_miles IS NOT NULL AND v_miles > 0 AND v_latest_log.servicemiles IS NOT NULL THEN
            v_nextmiles := v_latest_log.servicemiles + v_miles;
        END IF;
    END IF;

    UPDATE service_intervals
    SET nextdate = v_nextdate,
        nextmiles = v_nextmiles,
        modified = CURRENT_TIMESTAMP
    WHERE vehicleid = p_vehicleid AND serviceid = p_serviceid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_next_service()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalculate_service_interval(NEW.vehicleid, NEW.serviceid);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_next_service_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalculate_service_interval(OLD.vehicleid, OLD.serviceid);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_all_service_intervals()
RETURNS void AS $$
DECLARE
    v_interval RECORD;
BEGIN
    FOR v_interval IN
        SELECT vehicleid, serviceid FROM service_intervals
    LOOP
        PERFORM recalculate_service_interval(v_interval.vehicleid, v_interval.serviceid);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT recalculate_all_service_intervals();
