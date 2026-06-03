/** Whole-number id only (rejects balance amounts like 3230.69). */
export function parsePositiveIntId(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Balance snapshot row id from API (balance_id). Never treat balance amount as id.
 */
export function parseBalanceRowId(row) {
  if (!row) return null;
  const bid = parsePositiveIntId(row.balance_id);
  if (bid != null) return bid;
  const legacy = parsePositiveIntId(row.id);
  if (legacy == null) return null;
  if (row.balance != null && String(legacy) === String(row.balance).trim()) return null;
  if (row.balance != null && String(row.id).trim() === String(row.balance).trim()) return null;
  return legacy;
}
