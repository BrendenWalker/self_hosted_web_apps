-- 016_tax_parameters.sql
-- Move annually variable IRS values from code into DB. See docs/implementation_plan.md (M1).

CREATE TABLE IF NOT EXISTS tax_year (
    year                INTEGER PRIMARY KEY CHECK (year >= 2020 AND year <= 2100),
    status              VARCHAR(20) NOT NULL CHECK (status IN ('published','projected')),
    inflation_pct       DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    notes               TEXT,
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_standard_deduction (
    year                INTEGER NOT NULL REFERENCES tax_year(year) ON DELETE CASCADE,
    filing_status       VARCHAR(40) NOT NULL
        CHECK (filing_status IN ('single','married_filing_jointly','married_filing_separately','head_of_household')),
    amount              DECIMAL(12,2) NOT NULL,
    age65_add_on        DECIMAL(12,2) NOT NULL DEFAULT 0,
    source              VARCHAR(20) NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded','user_edited')),
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (year, filing_status)
);

CREATE TABLE IF NOT EXISTS tax_bracket (
    year                INTEGER NOT NULL REFERENCES tax_year(year) ON DELETE CASCADE,
    filing_status       VARCHAR(40) NOT NULL
        CHECK (filing_status IN ('single','married_filing_jointly','married_filing_separately','head_of_household')),
    ordinal             INTEGER NOT NULL CHECK (ordinal >= 0),
    lower_bound         DECIMAL(14,2) NOT NULL,
    rate                DECIMAL(6,4) NOT NULL CHECK (rate >= 0 AND rate < 1),
    source              VARCHAR(20) NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded','user_edited')),
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (year, filing_status, ordinal)
);

CREATE TABLE IF NOT EXISTS tax_contribution_limit (
    year                INTEGER NOT NULL REFERENCES tax_year(year) ON DELETE CASCADE,
    kind                VARCHAR(40) NOT NULL
        CHECK (kind IN ('ira','401k_elective','hsa_individual','hsa_family')),
    base_amount         DECIMAL(12,2) NOT NULL,
    catch_up_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
    source              VARCHAR(20) NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded','user_edited')),
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (year, kind)
);

CREATE TABLE IF NOT EXISTS tax_medicare_part_b (
    year                INTEGER PRIMARY KEY REFERENCES tax_year(year) ON DELETE CASCADE,
    monthly_premium     DECIMAL(10,2) NOT NULL,
    source              VARCHAR(20) NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded','user_edited')),
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tax_year (year, status, inflation_pct, notes) VALUES
    (2024, 'published', 2.00, 'IRS Rev. Proc. 2023-34'),
    (2025, 'published', 2.00, 'IRS Rev. Proc. 2024-40'),
    (2026, 'published', 2.00, 'IRS Rev. Proc. 2025-32 / TCJA post-sunset values')
ON CONFLICT (year) DO NOTHING;

INSERT INTO tax_standard_deduction (year, filing_status, amount, age65_add_on) VALUES
    (2024, 'married_filing_jointly', 29200, 1550),
    (2025, 'married_filing_jointly', 30000, 1550),
    (2026, 'married_filing_jointly', 31000, 1550),
    (2024, 'single',                 14600, 1950),
    (2025, 'single',                 15000, 1950),
    (2026, 'single',                 15750, 1950),
    (2024, 'head_of_household',      21900, 1950),
    (2025, 'head_of_household',      22500, 1950),
    (2026, 'head_of_household',      23400, 1950)
ON CONFLICT (year, filing_status) DO NOTHING;

INSERT INTO tax_bracket (year, filing_status, ordinal, lower_bound, rate) VALUES
    (2024, 'married_filing_jointly', 0,      0.00, 0.10),
    (2024, 'married_filing_jointly', 1,  23200.00, 0.12),
    (2024, 'married_filing_jointly', 2,  94300.00, 0.22),
    (2024, 'married_filing_jointly', 3, 201050.00, 0.24),
    (2024, 'married_filing_jointly', 4, 383900.00, 0.32),
    (2024, 'married_filing_jointly', 5, 487450.00, 0.35),
    (2024, 'married_filing_jointly', 6, 731200.00, 0.37),
    (2025, 'married_filing_jointly', 0,      0.00, 0.10),
    (2025, 'married_filing_jointly', 1,  23850.00, 0.12),
    (2025, 'married_filing_jointly', 2,  96950.00, 0.22),
    (2025, 'married_filing_jointly', 3, 206700.00, 0.24),
    (2025, 'married_filing_jointly', 4, 394600.00, 0.32),
    (2025, 'married_filing_jointly', 5, 501050.00, 0.35),
    (2025, 'married_filing_jointly', 6, 751600.00, 0.37),
    (2026, 'married_filing_jointly', 0,      0.00, 0.10),
    (2026, 'married_filing_jointly', 1,  24327.00, 0.12),
    (2026, 'married_filing_jointly', 2,  98889.00, 0.22),
    (2026, 'married_filing_jointly', 3, 210834.00, 0.24),
    (2026, 'married_filing_jointly', 4, 402492.00, 0.32),
    (2026, 'married_filing_jointly', 5, 511071.00, 0.35),
    (2026, 'married_filing_jointly', 6, 766632.00, 0.37),
    (2024, 'single', 0,      0.00, 0.10),
    (2024, 'single', 1,  11600.00, 0.12),
    (2024, 'single', 2,  47150.00, 0.22),
    (2024, 'single', 3, 100525.00, 0.24),
    (2024, 'single', 4, 191950.00, 0.32),
    (2024, 'single', 5, 243725.00, 0.35),
    (2024, 'single', 6, 609350.00, 0.37),
    (2025, 'single', 0,      0.00, 0.10),
    (2025, 'single', 1,  11925.00, 0.12),
    (2025, 'single', 2,  48475.00, 0.22),
    (2025, 'single', 3, 103350.00, 0.24),
    (2025, 'single', 4, 197300.00, 0.32),
    (2025, 'single', 5, 250525.00, 0.35),
    (2025, 'single', 6, 626350.00, 0.37),
    (2026, 'single', 0,      0.00, 0.10),
    (2026, 'single', 1,  12164.00, 0.12),
    (2026, 'single', 2,  49445.00, 0.22),
    (2026, 'single', 3, 105417.00, 0.24),
    (2026, 'single', 4, 201246.00, 0.32),
    (2026, 'single', 5, 255535.00, 0.35),
    (2026, 'single', 6, 638877.00, 0.37),
    (2025, 'head_of_household', 0,      0.00, 0.10),
    (2025, 'head_of_household', 1,  17000.00, 0.12),
    (2025, 'head_of_household', 2,  64850.00, 0.22),
    (2025, 'head_of_household', 3, 103350.00, 0.24),
    (2025, 'head_of_household', 4, 197300.00, 0.32),
    (2025, 'head_of_household', 5, 256100.00, 0.35),
    (2025, 'head_of_household', 6, 626350.00, 0.37)
ON CONFLICT DO NOTHING;

INSERT INTO tax_contribution_limit (year, kind, base_amount, catch_up_amount) VALUES
    (2024, 'ira',            7000, 1000),
    (2024, '401k_elective', 23000, 7500),
    (2024, 'hsa_individual', 4150, 1000),
    (2024, 'hsa_family',     8300, 1000),
    (2025, 'ira',            7000, 1000),
    (2025, '401k_elective', 23500, 7500),
    (2025, 'hsa_individual', 4300, 1000),
    (2025, 'hsa_family',     8550, 1000),
    (2026, 'ira',            7500, 1100),
    (2026, '401k_elective', 24500, 8000),
    (2026, 'hsa_individual', 4400, 1000),
    (2026, 'hsa_family',     8750, 1000)
ON CONFLICT DO NOTHING;

INSERT INTO tax_medicare_part_b (year, monthly_premium) VALUES
    (2024, 174.70),
    (2025, 185.00),
    (2026, 193.00)
ON CONFLICT (year) DO NOTHING;
