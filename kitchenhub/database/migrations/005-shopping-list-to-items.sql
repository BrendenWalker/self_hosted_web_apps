-- Migrate shopping list into items.qty and drop shopping_list table.
-- Run once after deploying backend that uses items (qty > 0) as shopping list.
-- Run: psql -U postgres -d <dbname> -f kitchenhub/database/migrations/005-shopping-list-to-items.sql

-- Sync qty from shopping_list into items (by item_id or by name). Purchased rows become qty 0.
UPDATE items i
SET qty = CASE
  WHEN sl.purchased = 1 THEN 0
  ELSE GREATEST(0, COALESCE(
    CAST(NULLIF(TRIM(REGEXP_REPLACE(COALESCE(sl.quantity, '1'), '[^0-9.]', '', 'g')), '') AS NUMERIC),
    1
  ))
END
FROM shopping_list sl
WHERE (sl.item_id IS NOT NULL AND i.id = sl.item_id)
   OR (sl.item_id IS NULL AND i.name = sl.name);

-- Drop indexes then table (order per PostgreSQL)
DROP INDEX IF EXISTS idx_shopping_list_purchased;
DROP INDEX IF EXISTS idx_shopping_list_itemid;
DROP INDEX IF EXISTS idx_shopping_list_dept;
DROP TABLE IF EXISTS shopping_list;
