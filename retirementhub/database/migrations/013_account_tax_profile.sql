-- Tax profile for taxable brokerage accounts (blended basis MVP)

CREATE TABLE IF NOT EXISTS account_tax_profile (
    account_id INTEGER PRIMARY KEY REFERENCES account(id) ON DELETE CASCADE,
    cost_basis DECIMAL(14, 2),
    unrealized_gain_percent DECIMAL(5, 2) DEFAULT 0
        CHECK (unrealized_gain_percent IS NULL OR (unrealized_gain_percent >= 0 AND unrealized_gain_percent <= 100)),
    dividend_yield DECIMAL(5, 4) DEFAULT 0
        CHECK (dividend_yield IS NULL OR (dividend_yield >= 0 AND dividend_yield <= 1)),
    qualified_dividend_percent DECIMAL(5, 2) DEFAULT 100
        CHECK (qualified_dividend_percent IS NULL OR (qualified_dividend_percent >= 0 AND qualified_dividend_percent <= 100)),
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
