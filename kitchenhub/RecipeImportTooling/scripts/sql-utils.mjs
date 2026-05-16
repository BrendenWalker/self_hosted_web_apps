/**
 * Shared SQL helpers for RecipeImportTooling scripts.
 */

export function escSql(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/\0/g, '').replace(/'/g, "''");
}

export function trunc80(s) {
  const t = String(s).trim();
  return t.length <= 80 ? t : t.slice(0, 80);
}

export function trunc255(s) {
  const t = String(s).trim();
  return t.length <= 255 ? t : t.slice(0, 255);
}

/**
 * @param {Array<{qty:number,meas:string,name:string,comment:string|null}>} rows
 */
export function mergeRecipeLines(rows) {
  const byName = new Map();
  for (const r of rows) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
  }
  const out = [];
  for (const [, list] of byName) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const byMeas = new Map();
    for (const r of list) {
      if (!byMeas.has(r.meas)) byMeas.set(r.meas, []);
      byMeas.get(r.meas).push(r);
    }
    if (byMeas.size === 1) {
      const meas = [...byMeas.keys()][0];
      const sum = list.reduce((a, b) => a + Number(b.qty), 0);
      const comments = list.map((x) => x.comment).filter(Boolean).join('; ');
      out.push({
        qty: Number(sum.toFixed(4)),
        meas,
        name: list[0].name,
        comment: comments || null,
      });
    } else {
      const first = list[0];
      const parts = list.map(
        (r) => `${r.qty} ${r.meas}${r.comment ? ` (${r.comment})` : ''}`
      );
      out.push({
        qty: Number(first.qty),
        meas: first.meas,
        name: first.name,
        comment: parts.join(' + '),
      });
    }
  }
  return out;
}

/** Filesystem-safe slug from recipe name. */
export function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'recipe';
}
