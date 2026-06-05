-- Materialized per-year scenario results and household snapshot at creation

ALTER TABLE scenario
    ADD COLUMN IF NOT EXISTS base_household_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS last_computed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS scenario_yearly_result (
    scenario_id INTEGER NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    result_row JSONB NOT NULL,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scenario_id, year)
);

CREATE INDEX IF NOT EXISTS idx_scenario_yearly_result_scenario
    ON scenario_yearly_result (scenario_id);
