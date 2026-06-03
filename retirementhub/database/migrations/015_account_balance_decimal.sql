-- Ensure account_balance.balance accepts cents (e.g. 3230.69).
-- Older DBs may have INTEGER here, which causes:
--   invalid input syntax for type integer: "3230.69"

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'account_balance'
      AND column_name = 'balance'
      AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE account_balance
      ALTER COLUMN balance TYPE DECIMAL(14, 2)
      USING balance::DECIMAL(14, 2);
  END IF;
END $$;
