-- Asset accounts may be sold in retirement to cover living expense shortfalls after savings withdrawals.
ALTER TABLE account ADD COLUMN IF NOT EXISTS liquidate_in_retirement BOOLEAN NOT NULL DEFAULT FALSE;
