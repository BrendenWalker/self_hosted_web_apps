#!/usr/bin/env node
/**
 * Validate parsed recipe JSON against KitchenHub Postgres (items + measurements).
 *
 * Usage:
 *   node validate-recipe-import.mjs parsed.json
 *   node validate-recipe-import.mjs parsed.json --json
 *   node validate-recipe-import.mjs --list-categories
 *   cat parsed.json | node validate-recipe-import.mjs -
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeIngredient } from './item-normalize.mjs';
import { departmentSqlExpr } from './department-sql.mjs';
import { canonicalizeMeasurement } from './measurement-canonical.mjs';
import { createPool } from './db-connection.mjs';
import { escSql, trunc80, trunc255, mergeRecipeLines } from './sql-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  console.error(`
validate-recipe-import.mjs [parsed.json|-] [--json] [--list-categories]

Validates recipe JSON against public.items and common.measurements.
Exit 0 when all ingredients and units resolve; exit 1 otherwise.

JSON shape:
  { "name": "...", "servings": 4, "instructions": "...",
    "ingredients": [{ "qty": 1, "measurement": "Cup", "item": "Flour", "comment": null }] }

Optional per line: "raw" (re-normalized via item-normalize.mjs), "category" for draft item SQL.
`);
}

function parseArgs(argv) {
  const flags = { json: false, listCategories: false };
  const paths = [];
  for (const a of argv) {
    if (a === '--json') flags.json = true;
    else if (a === '--list-categories') flags.listCategories = true;
    else if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    } else paths.push(a);
  }
  return { flags, paths };
}

async function readJsonInput(paths) {
  const file = paths[0] || '-';
  const text =
    file === '-'
      ? await new Promise((resolve, reject) => {
          const chunks = [];
          process.stdin.on('data', (c) => chunks.push(c));
          process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          process.stdin.on('error', reject);
        })
      : fs.readFileSync(path.resolve(file), 'utf8');
  return JSON.parse(text);
}

/**
 * @param {object} payload
 */
function prepareIngredients(payload) {
  const rows = [];
  for (const line of payload.ingredients || []) {
    let item = line.item;
    let comment = line.comment ?? null;
    let category = line.category ?? null;

    // raw is ingredient text only (no qty/unit); do not override an explicit item
    if (line.raw && (!item || String(item).trim() === '')) {
      const norm = normalizeIngredient(line.raw);
      item = norm.name;
      if (!comment && norm.comment) comment = norm.comment;
      if (!category) category = norm.category;
    }

    rows.push({
      qty: Number(line.qty),
      meas: canonicalizeMeasurement(line.measurement),
      name: trunc80(item),
      comment: comment ? trunc255(comment) : null,
      category: category || 'misc',
    });
  }
  return mergeRecipeLines(rows);
}

function draftItemInsertSql(name, category, details) {
  const dept = departmentSqlExpr(category);
  const det =
    details === null || details === ''
      ? 'NULL'
      : `'${escSql(details)}'`;
  return `INSERT INTO public.items (name, department, details) VALUES\n('${escSql(name)}', ${dept}, ${det})\nON CONFLICT (name) DO NOTHING;`;
}

async function listCategories(pool) {
  const result = await pool.query(
    'SELECT name FROM recipe.recipe_category ORDER BY name'
  );
  return result.rows.map((r) => r.name);
}

async function validate(pool, payload) {
  const ingredients = prepareIngredients(payload);
  const itemNames = [...new Set(ingredients.map((r) => r.name))];
  const measNames = [...new Set(ingredients.map((r) => r.meas))];

  const [itemsRes, measRes, cats] = await Promise.all([
    itemNames.length
      ? pool.query('SELECT name FROM public.items WHERE name = ANY($1::text[])', [
          itemNames,
        ])
      : { rows: [] },
    measNames.length
      ? pool.query(
          'SELECT name FROM common.measurements WHERE name = ANY($1::text[])',
          [measNames]
        )
      : { rows: [] },
    listCategories(pool),
  ]);

  const foundItems = new Set(itemsRes.rows.map((r) => r.name));
  const foundMeas = new Set(measRes.rows.map((r) => r.name));

  const items = [];
  for (const name of itemNames) {
    const lines = ingredients.filter((r) => r.name === name);
    const category = lines[0]?.category || 'misc';
    if (foundItems.has(name)) {
      items.push({ name, status: 'ok', suggestions: [], decisionRequired: false });
    } else {
      const sugRes = await pool.query(
        `SELECT name FROM public.items
         WHERE name ILIKE '%' || $1 || '%'
         ORDER BY name
         LIMIT 5`,
        [name]
      );
      const suggestions = sugRes.rows.map((r) => r.name);
      items.push({
        name,
        status: 'missing',
        category,
        suggestions,
        draftSql: draftItemInsertSql(name, category, null),
        decisionRequired: true,
        decisionOptions: ['map_to_existing', 'create_new_item', 'omit_line'],
        agentInstruction:
          'STOP. Ask the user to map to a suggestion, create the item themselves (optional draftSql), or omit the line. Do not INSERT or auto-map.',
      });
    }
  }

  const measurements = measNames.map((name) => ({
    name,
    status: foundMeas.has(name) ? 'ok' : 'missing',
    ...(foundMeas.has(name)
      ? { decisionRequired: false }
      : {
          decisionRequired: true,
          decisionOptions: ['map_to_existing', 'create_new_measurement'],
          agentInstruction:
            'STOP. Ask the user to pick an existing measurement name or create one manually. Do not INSERT.',
        }),
  }));

  const missingItems = items.filter((i) => i.status === 'missing');
  const missingMeasurements = measurements.filter((m) => m.status === 'missing');
  const ok =
    missingItems.length === 0 && missingMeasurements.length === 0;

  return {
    ok,
    requiresUserDecision: !ok,
    recipe: {
      name: trunc80(payload.name),
      servings: Number.parseInt(payload.servings, 10) || 4,
      instructions: payload.instructions ?? '',
    },
    ingredients,
    items,
    measurements,
    categories: cats,
    missingItems: missingItems.map((i) => i.name),
    missingMeasurements: missingMeasurements.map((m) => m.name),
  };
}

async function main() {
  const { flags, paths } = parseArgs(process.argv.slice(2));
  const pool = createPool();

  try {
    if (flags.listCategories) {
      const cats = await listCategories(pool);
      if (flags.json) {
        console.log(JSON.stringify({ categories: cats }, null, 2));
      } else {
        console.log('Recipe categories:');
        for (const c of cats) console.log(`  - ${c}`);
      }
      process.exit(0);
    }

    if (paths.length === 0) {
      usage();
      process.exit(1);
    }

    const payload = await readJsonInput(paths);
    const report = await validate(pool, payload);

    if (flags.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Recipe: ${report.recipe.name} (${report.recipe.servings} servings)`);
      console.log('');
      console.log('Items:');
      for (const i of report.items) {
        const sug =
          i.suggestions?.length > 0
            ? ` → suggestions: ${i.suggestions.join(', ')}`
            : '';
        console.log(`  ${i.status === 'ok' ? '✓' : '✗'} ${i.name}${sug}`);
      }
      console.log('');
      console.log('Measurements:');
      for (const m of report.measurements) {
        console.log(`  ${m.status === 'ok' ? '✓' : '✗'} ${m.name}`);
      }
      console.log('');
      console.log(
        report.ok
          ? 'OK — all ingredients and measurements resolve.'
          : `BLOCKED — ${report.missingItems.length} item(s) and ${report.missingMeasurements.length} measurement(s) need USER decisions before re-validate.`
      );
      if (!report.ok) {
        console.log(
          '\nAGENT: Do NOT insert into the database or auto-map. Ask the user per missing row: map | create | omit (items) or map | create (measurements).'
        );
        if (report.items.some((i) => i.draftSql)) {
          console.log(
            '\n--- Optional draft item SQL (USER runs if they choose create; agent must not execute) ---\n'
          );
          for (const i of report.items) {
            if (i.draftSql) {
              const sug =
                i.suggestions?.length > 0
                  ? `\n-- Suggestions: ${i.suggestions.join(', ')}`
                  : '';
              console.log(`${i.draftSql}${sug}\n`);
            }
          }
        }
      }
    }

    process.exit(report.ok ? 0 : 1);
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

main();
