#!/usr/bin/env node
/**
 * Build SQL to insert USDA commodity foods (Foundation + SR Legacy) into KitchenHub `items`.
 *
 * No API key: uses FoodData Central **bulk CSV** downloads.
 * See: https://fdc.nal.usda.gov/download-datasets.html
 *
 * Usage:
 *   1. Download and unzip e.g. "Foundation Foods" and "SR Legacy" CSV bundles.
 *   2. Point --csv-dir at each extracted folder (must contain food.csv, food_nutrient.csv, nutrient.csv).
 *   3. Target department: either --department-id=N or --department-name=Pantry
 *      (name is case-insensitive, ingredient departments only; resolved in SQL at psql time).
 *
 *   node kitchenhub/database/scripts/bootstrap-usda-commodities.mjs \
 *     --csv-dir="D:/fdc/Foundation" \
 *     --csv-dir="D:/fdc/SR_Legacy" \
 *     --department-name=Pantry \
 *     --out=kitchenhub/database/sql/bootstrap-usda-items.sql
 *
 *   psql -U postgres -d kitchenhub -f kitchenhub/database/sql/bootstrap-usda-items.sql
 *
 * Optional: --apply runs the SQL via pg (requires deps from kitchenhub/backend; run from repo with NODE_PATH or use psql).
 *
 * @typedef {{ fdcId: number, description: string, dataType: string, kcal: number }} FoodRow
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  console.error(`
bootstrap-usda-commodities.mjs

Required (pick one department option):
  --department-id=N       common.department id for every imported item (literal in SQL)
  --department-name=STR   match common.department by name (case-insensitive, ingredient rows only)
  --csv-dir=PATH          folder with USDA CSV export (repeat for Foundation + SR Legacy)

Optional:
  --limit=800           max rows to emit (after filter + sort)
  --out=PATH            write SQL here (default: kitchenhub/database/sql/bootstrap-usda-items.sql)
  --apply               execute SQL using pg (load from kitchenhub/backend/node_modules)

Examples:
  node kitchenhub/database/scripts/bootstrap-usda-commodities.mjs \\
    --csv-dir="./fdc/Foundation" --csv-dir="./fdc/SR_Legacy" --department-name=Pantry
`);
}

function parseArgs(argv) {
  const out = {
    csvDirs: [],
    departmentId: null,
    departmentName: null,
    limit: 800,
    outPath: null,
    apply: false,
  };
  for (const a of argv) {
    if (a === '--apply') out.apply = true;
    else if (a.startsWith('--csv-dir=')) out.csvDirs.push(a.slice('--csv-dir='.length));
    else if (a.startsWith('--department-id=')) out.departmentId = Number(a.slice('--department-id='.length));
    else if (a.startsWith('--department-name=')) out.departmentName = a.slice('--department-name='.length).trim() || null;
    else if (a.startsWith('--limit=')) out.limit = Math.max(1, Number(a.slice('--limit='.length)) || 800);
    else if (a.startsWith('--out=')) out.outPath = a.slice('--out='.length);
  }
  return out;
}

/** Minimal CSV field splitter (handles quoted fields with doubled quotes). */
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function headerIndex(headerLine) {
  const cols = parseCsvLine(headerLine).map((h) => h.replace(/^\ufeff/, '').trim().toLowerCase());
  const idx = (name) => cols.indexOf(name);
  return { cols, idx };
}

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const COMMODITY_TYPES = new Set(['foundation', 'sr legacy']);

/**
 * @param {string} nutrientCsvPath
 * @returns {Promise<{ kcalNutrientIds: Set<number>, nutrientPriority: Map<number, number> }>}
 */
async function loadKcalNutrientMeta(nutrientCsvPath) {
  const kcalNutrientIds = new Set();
  const nutrientPriority = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(nutrientCsvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let header = null;
  for await (const line of rl) {
    if (!header) {
      header = headerIndex(line);
      continue;
    }
    const parts = parseCsvLine(line);
    const id = Number(parts[header.idx('id')]);
    if (!Number.isInteger(id)) continue;
    const unit = String(parts[header.idx('unit_name')] || '').trim().toLowerCase();
    const nbr = String(parts[header.idx('nutrient_nbr')] || '').trim();
    const name = String(parts[header.idx('name')] || '').toLowerCase();
    if (unit !== 'kcal') continue;
    if (name.includes('alcohol')) continue;
    const isEnergy =
      name.includes('energy') ||
      ['208', '268', '957', '958'].includes(nbr) ||
      [1008, 2047, 2048].includes(id);
    if (!isEnergy) continue;
    kcalNutrientIds.add(id);
    let pr = 50;
    if (id === 1008) pr = 0;
    else if (id === 2047 || id === 2048) pr = 1;
    else if (nbr === '208') pr = 2;
    nutrientPriority.set(id, pr);
  }
  return { kcalNutrientIds, nutrientPriority };
}

/**
 * @param {string} foodCsvPath
 * @returns {Promise<Map<number, { fdcId: number, description: string, dataType: string }>>}
 */
async function loadFoodRows(foodCsvPath) {
  const byId = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(foodCsvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let header = null;
  for await (const line of rl) {
    if (!header) {
      header = headerIndex(line);
      continue;
    }
    const parts = parseCsvLine(line);
    const fdcId = Number(parts[header.idx('fdc_id')]);
    if (!Number.isInteger(fdcId)) continue;
    const dataType = String(parts[header.idx('data_type')] || '').trim();
    const description = String(parts[header.idx('description')] || '').trim();
    if (!description) continue;
    const dtKey = dataType.toLowerCase();
    if (!COMMODITY_TYPES.has(dtKey)) continue;
    byId.set(fdcId, { fdcId, description, dataType });
  }
  return byId;
}

/**
 * Stream food_nutrient.csv; for fdc_id in `wanted`, pick best kcal amount by nutrient priority.
 */
async function loadKcalByFdc(foodNutrientPath, wanted, kcalNutrientIds, nutrientPriority) {
  /** @type {Map<number, { amount: number, pr: number }>} */
  const best = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(foodNutrientPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let header = null;
  for await (const line of rl) {
    if (!header) {
      header = headerIndex(line);
      continue;
    }
    const parts = parseCsvLine(line);
    const fdcId = Number(parts[header.idx('fdc_id')]);
    if (!wanted.has(fdcId)) continue;
    const nutrientId = Number(parts[header.idx('nutrient_id')]);
    if (!kcalNutrientIds.has(nutrientId)) continue;
    const amount = Number(parts[header.idx('amount')]);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const pr = nutrientPriority.get(nutrientId) ?? 40;
    const prev = best.get(fdcId);
    if (!prev || pr < prev.pr || (pr === prev.pr && amount > prev.amount)) {
      best.set(fdcId, { amount: Math.round(amount), pr });
    }
  }
  /** @type {Map<number, number>} */
  const out = new Map();
  for (const [fdcId, v] of best) out.set(fdcId, v.amount);
  return out;
}

function truncateName(desc) {
  const t = desc.trim();
  if (t.length <= 80) return t;
  return t.slice(0, 79) + '…';
}

function detailsLine(fdcId, dataType, fullDescription) {
  const base = `USDA ${dataType} · FDC ${fdcId}`;
  const rest = fullDescription.length ? ` · ${fullDescription}` : '';
  const combined = (base + rest).trim();
  if (combined.length <= 255) return combined;
  return combined.slice(0, 252) + '…';
}

/**
 * @param {FoodRow[]} rows
 * @param {{ type: 'id'; id: number } | { type: 'name'; name: string }} dept
 */
function buildSql(rows, dept) {
  const lines = [
    '-- KitchenHub: USDA Foundation + SR Legacy commodity bootstrap',
    '-- kcal is per 100 g; kcal_measurement_id resolved at run time to common.measurements "g"',
    'BEGIN;',
  ];
  const deptExpr =
    dept.type === 'id'
      ? String(dept.id)
      : `d.id`;
  const deptJoin =
    dept.type === 'id'
      ? ''
      : ` INNER JOIN common.department d ON lower(trim(d.name)) = lower(trim(${sqlLiteral(dept.name)})) AND d.ingredient IS TRUE`;
  for (const r of rows) {
    const name = truncateName(r.description);
    const det = detailsLine(r.fdcId, r.dataType, r.description);
    lines.push(`INSERT INTO items (name, department, qty, details, kcal, kcal_qty, kcal_measurement_id, shopping_measure, ingredient_unit_grams, count_per_pack, shopping_measure_grams, usda_fdc_id, usda_data_type, usda_description, nutrition_synced_at)
SELECT ${sqlLiteral(name)}, ${deptExpr}, 0, ${sqlLiteral(det)}, ${r.kcal}, 100, m.id, NULL, NULL, NULL, NULL, ${r.fdcId}, ${sqlLiteral(r.dataType)}, ${sqlLiteral(r.description)}, CURRENT_TIMESTAMP
FROM common.measurements m${deptJoin} WHERE lower(m.name) = 'g' LIMIT 1
ON CONFLICT (name) DO NOTHING;`);
  }
  lines.push('COMMIT;');
  return `${lines.join('\n')}\n`;
}

async function tryLoadPg() {
  const backendPkg = path.join(__dirname, '..', '..', 'backend', 'package.json');
  const req = createRequire(backendPkg);
  return req('pg');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const hasId = Number.isInteger(args.departmentId) && args.departmentId > 0;
  const hasName = Boolean(args.departmentName);
  if (hasId && hasName) {
    console.error('Use only one of --department-id or --department-name.');
    process.exit(1);
  }
  if (!hasId && !hasName) {
    usage();
    process.exit(1);
  }
  if (args.csvDirs.length === 0) {
    usage();
    process.exit(1);
  }

  for (const d of args.csvDirs) {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) {
      console.error(`Not a directory: ${d}`);
      process.exit(1);
    }
  }

  let nutrientPath = null;
  for (const d of args.csvDirs) {
    const p = path.join(d, 'nutrient.csv');
    if (fs.existsSync(p)) {
      nutrientPath = p;
      break;
    }
  }
  if (!nutrientPath) {
    console.error('Could not find nutrient.csv in any --csv-dir (unzip the USDA CSV bundle fully).');
    process.exit(1);
  }

  const { kcalNutrientIds, nutrientPriority } = await loadKcalNutrientMeta(nutrientPath);
  if (kcalNutrientIds.size === 0) {
    console.error('No kcal energy nutrient ids found in nutrient.csv');
    process.exit(1);
  }

  /** @type {Map<number, { fdcId: number, description: string, dataType: string }>} */
  const foods = new Map();
  for (const d of args.csvDirs) {
    const foodCsv = path.join(d, 'food.csv');
    if (!fs.existsSync(foodCsv)) {
      console.error(`Missing food.csv in ${d}`);
      process.exit(1);
    }
    const chunk = await loadFoodRows(foodCsv);
    for (const [id, row] of chunk) foods.set(id, row);
  }

  const sorted = [...foods.values()].sort((a, b) =>
    a.description.localeCompare(b.description, undefined, { sensitivity: 'base' })
  );
  const limited = sorted.slice(0, args.limit);
  const wanted = new Set(limited.map((r) => r.fdcId));

  /** @type {Map<number, number>} */
  let kcalByFdc = new Map();
  for (const d of args.csvDirs) {
    const fnPath = path.join(d, 'food_nutrient.csv');
    if (!fs.existsSync(fnPath)) continue;
    const part = await loadKcalByFdc(fnPath, wanted, kcalNutrientIds, nutrientPriority);
    for (const [fdcId, kcal] of part) kcalByFdc.set(fdcId, kcal);
  }

  /** @type {FoodRow[]} */
  const withKcal = [];
  for (const row of limited) {
    const kcal = kcalByFdc.get(row.fdcId);
    if (kcal == null) continue;
    withKcal.push({ ...row, kcal });
  }

  const outPath =
    args.outPath ||
    path.join(__dirname, '..', 'sql', 'bootstrap-usda-items.sql');
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  /** @type {{ type: 'id'; id: number } | { type: 'name'; name: string }} */
  const dept = hasId ? { type: 'id', id: args.departmentId } : { type: 'name', name: /** @type {string} */ (args.departmentName) };

  const sql = buildSql(withKcal, dept);
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log(`Wrote ${withKcal.length} INSERT statements (${foods.size} foods scanned, ${limited.length} limited) -> ${outPath}`);
  console.log('Apply with: psql -U postgres -d kitchenhub -v ON_ERROR_STOP=1 -f ' + outPath);

  if (args.apply) {
    const { Client } = await tryLoadPg();
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'kitchenhub',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });
    await client.connect();
    try {
      if (dept.type === 'name') {
        const check = await client.query(
          `SELECT id, name FROM common.department
           WHERE lower(trim(name)) = lower(trim($1)) AND ingredient IS TRUE`,
          [dept.name]
        );
        if (check.rows.length === 0) {
          throw new Error(
            `No ingredient department named "${dept.name}" (case-insensitive). Add one or fix --department-name.`
          );
        }
        if (check.rows.length > 1) {
          throw new Error(`Multiple ingredient departments matched "${dept.name}"; use --department-id instead.`);
        }
        console.log(`Resolved department "${check.rows[0].name}" -> id ${check.rows[0].id}`);
      }
      await client.query(sql);
      console.log('Applied SQL via pg.');
    } finally {
      await client.end();
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
