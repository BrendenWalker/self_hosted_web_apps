/**
 * Reads Recipe/Text/*.txt, Recipe/Text/PDF/*.txt, Recipe/Text/ODT/*.txt plus
 * recipe-ingredients-data.mjs, recipe-pdf-ingredients-data.mjs, recipe-odt-ingredients-data.mjs,
 * writes ../sql/import-text-recipes.sql (one-time import with normalized items).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import recipeDataText from './recipe-ingredients-data.mjs';
import recipePdfData from './recipe-pdf-ingredients-data.mjs';
import recipeOdtData from './recipe-odt-ingredients-data.mjs';
import { normalizeIngredient } from './item-normalize.mjs';
import { departmentSqlExpr } from './department-sql.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEXT_DIR = path.resolve(__dirname, '../Recipe/Text');
const OUT_SQL = path.resolve(__dirname, '../sql/import-text-recipes.sql');

/** Extracted PDF text only — not imported (reference: manuals, multi-recipe books). See emit-pdf-recipe-data.py */
const SKIP_PDF_TXT = new Set([
  'DUO-Series-Manual-English-January-24-2018-web.txt',
  'IP_for_Beginners.txt',
  'Indian Recipes.txt',
  'Vegetable Recipes.txt',
  'Salads Recipes.txt',
]);

const recipeData = { ...recipeDataText, ...recipePdfData, ...recipeOdtData };

function listRecipeTextFiles() {
  const root = fs
    .readdirSync(TEXT_DIR)
    .filter((f) => f.toLowerCase().endsWith('.txt'))
    .sort((a, b) => a.localeCompare(b));
  const pdfDir = path.join(TEXT_DIR, 'PDF');
  const pdf = fs.existsSync(pdfDir)
    ? fs
        .readdirSync(pdfDir)
        .filter(
          (f) =>
            f.toLowerCase().endsWith('.txt') && !SKIP_PDF_TXT.has(f)
        )
        .map((f) => `PDF/${f}`)
        .sort((a, b) => a.localeCompare(b))
    : [];
  const odtDir = path.join(TEXT_DIR, 'ODT');
  const odt = fs.existsSync(odtDir)
    ? fs
        .readdirSync(odtDir)
        .filter((f) => f.toLowerCase().endsWith('.txt'))
        .map((f) => `ODT/${f}`)
        .sort((a, b) => a.localeCompare(b))
    : [];
  return [...root, ...pdf, ...odt].sort((a, b) => a.localeCompare(b));
}

function escSql(s) {
  if (s === null || s === undefined) return '';
  // PostgreSQL rejects U+0000 in strings; drivers may surface this as "insufficient data left in message".
  return String(s).replace(/\0/g, '').replace(/'/g, "''");
}

function trunc80(s) {
  const t = String(s).trim();
  return t.length <= 80 ? t : t.slice(0, 80);
}

function trunc255(s) {
  const t = String(s).trim();
  return t.length <= 255 ? t : t.slice(0, 255);
}

/**
 * @param {Array<{qty:number,meas:string,name:string,comment:string|null}>} rows
 */
function mergeRecipeLines(rows) {
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
        (r) =>
          `${r.qty} ${r.meas}${r.comment ? ` (${r.comment})` : ''}`
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

const files = listRecipeTextFiles();

const missing = files.filter((f) => !recipeData[f]);
if (missing.length) {
  console.error('Missing recipe data for:', missing.join(', '));
  process.exit(1);
}

const extra = Object.keys(recipeData).filter((f) => !files.includes(f));
if (extra.length) {
  console.warn(
    'recipe data entries with no matching .txt (skipped in SQL):',
    extra.length
  );
}

/** @type {Map<string, { category: string, details: string | null }>} */
const itemCatalog = new Map();

for (const file of files) {
  const { ingredients } = recipeData[file];
  for (const [, , rawItem] of ingredients) {
    const norm = normalizeIngredient(rawItem);
    const name = trunc80(norm.name);
    if (!itemCatalog.has(name)) {
      itemCatalog.set(name, {
        category: norm.category,
        details: norm.comment ? trunc255(norm.comment) : null,
      });
    } else {
      const cur = itemCatalog.get(name);
      if (!cur.details && norm.comment) {
        cur.details = trunc255(norm.comment);
      }
    }
  }
}

const allMeasurements = new Set();
for (const file of files) {
  const { ingredients } = recipeData[file];
  for (const [, m] of ingredients) allMeasurements.add(m);
}

const lines = [];
lines.push('-- Generated by scripts/generate-text-recipes-sql.mjs (normalized items + departments)');
lines.push('-- Idempotent: recipes use ON CONFLICT (name) DO UPDATE; ingredients replaced per recipe.');
lines.push('-- Source: Recipe/Text, Recipe/Text/PDF, Recipe/Text/ODT — see RecipeConversion.md');
lines.push('-- Items: canonical names, comma text -> recipe_ingredients.comment or items.details');
lines.push('');
lines.push('BEGIN;');
lines.push('');

lines.push('-- 1) Measurements');
lines.push('INSERT INTO common.ingredient_measurements (name, to_grams) VALUES');
lines.push(
  [...allMeasurements]
    .sort()
    .map((n) => `    ('${escSql(n)}', NULL)`)
    .join(',\n') + '\nON CONFLICT (name) DO NOTHING;'
);
lines.push('');

lines.push('-- 2) Items (department via COALESCE exemplar items + common.department fallbacks)');
lines.push('INSERT INTO public.items (name, department, details)');
lines.push('VALUES');

const sortedNames = [...itemCatalog.keys()].sort((a, b) => a.localeCompare(b));
const itemValueLines = sortedNames.map((name) => {
  const { category, details } = itemCatalog.get(name);
  const dept = departmentSqlExpr(category);
  const det =
    details === null || details === ''
      ? 'NULL'
      : `'${escSql(details)}'`;
  return `    ('${escSql(name)}', ${dept}, ${det})`;
});
lines.push(itemValueLines.join(',\n'));
lines.push('ON CONFLICT (name) DO NOTHING;');
lines.push('');

const usedNames = new Set();

for (const file of files) {
  const entry = recipeData[file];
  let name = trunc80(entry.name);
  if (usedNames.has(name)) {
    const suffix = file.replace(/\.txt$/i, '');
    name = trunc80(`${entry.name} (${suffix})`);
    let n = 2;
    while (usedNames.has(name)) {
      name = trunc80(`${entry.name} (${suffix} ${n})`);
      n += 1;
    }
  }
  usedNames.add(name);

  const instructions = fs.readFileSync(path.join(TEXT_DIR, file), 'utf8');

  const expanded = entry.ingredients.map(([qty, meas, rawItem]) => {
    const norm = normalizeIngredient(rawItem);
    return {
      qty: Number(qty),
      meas,
      name: trunc80(norm.name),
      comment: norm.comment ? trunc255(norm.comment) : null,
    };
  });

  const ing = mergeRecipeLines(expanded);

  const nameLit = `'${escSql(name)}'`;
  lines.push(`-- ${file}`);
  lines.push('INSERT INTO recipe.recipe (name, servings, instructions) VALUES (');
  lines.push(`    ${nameLit},`);
  lines.push(`    ${Number.parseInt(entry.servings, 10) || 4},`);
  lines.push(`    '${escSql(instructions)}'`);
  lines.push(')');
  lines.push('ON CONFLICT (name) DO UPDATE SET');
  lines.push('    servings = EXCLUDED.servings,');
  lines.push('    instructions = EXCLUDED.instructions;');
  lines.push('');
  lines.push('DELETE FROM recipe.recipe_ingredients');
  lines.push(
    `WHERE recipe_id = (SELECT id FROM recipe.recipe WHERE name = ${nameLit} LIMIT 1);`
  );
  lines.push('');
  lines.push(
    'INSERT INTO recipe.recipe_ingredients (recipe_id, ingredient_id, qty, measurement_id, comment)'
  );
  lines.push('SELECT');
  lines.push(`    (SELECT id FROM recipe.recipe WHERE name = ${nameLit} LIMIT 1),`);
  lines.push('    items.id,');
  lines.push('    recipe_data.qty_val,');
  lines.push('    measurements.id,');
  lines.push('    NULLIF(recipe_data.comment_text, \'\')');
  lines.push('FROM (');
  lines.push('    VALUES');
  const valueLines = ing.map((r) => {
    const c = r.comment === null ? 'NULL' : `'${escSql(r.comment)}'`;
    return `    (${Number(r.qty)}, '${escSql(r.meas)}', '${escSql(r.name)}', ${c})`;
  });
  lines.push(valueLines.join(',\n'));
  lines.push(
    ') AS recipe_data(qty_val, measurement_name, item_name, comment_text)'
  );
  lines.push('JOIN public.items items ON items.name = recipe_data.item_name');
  lines.push(
    'JOIN common.ingredient_measurements measurements ON measurements.name = recipe_data.measurement_name;'
  );
  lines.push('');
}

lines.push('COMMIT;');

fs.mkdirSync(path.dirname(OUT_SQL), { recursive: true });
fs.writeFileSync(OUT_SQL, lines.join('\n'), 'utf8');
console.log('Wrote', OUT_SQL);
console.log('Recipes:', files.length, 'Unique items:', itemCatalog.size);
