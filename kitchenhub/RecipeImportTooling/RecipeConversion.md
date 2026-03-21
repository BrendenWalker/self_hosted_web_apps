# Recipe database import guide

Use this guide to turn a recipe in plain text into SQL that inserts into the KitchenHub PostgreSQL database. Recipe ingredients are stored as rows in `public.items`; units are rows in `common.ingredient_measurements`. The junction table `recipe.recipe_ingredients` uses the column name `ingredient_id` to reference `public.items(id)`.

## 1. Relevant tables

### `recipe.recipe`

High-level recipe data. Omit `id` so the `SERIAL` primary key is generated.

| Column         | Notes |
|----------------|--------|
| `id`           | `SERIAL` — omit from `INSERT` |
| `name`         | Required; must be unique (`VARCHAR(80)`) |
| `servings`     | Required; integer (e.g. headcount or a placeholder like `99` if unknown) |
| `instructions` | `TEXT` |
| `image`        | Optional `BYTEA`; omit if not used |

Typical import statement:

```sql
INSERT INTO recipe.recipe (name, servings, instructions) VALUES
('Recipe Name', 4, 'Step 1: ...');
```

### `public.items`

Pantry / ingredient catalog. Each distinct ingredient name used in a recipe must exist here (or be inserted first). `department` references `common.department(id)` and may be **NULL** (uncategorized) in the schema; imports sometimes use a numeric placeholder or resolve department via existing items (see §6).

```sql
INSERT INTO public.items (name, department, details) VALUES
('Ingredient Name', NULL, NULL)
ON CONFLICT (name) DO NOTHING;
```

Optional `details` (`VARCHAR(255)`) can hold a stable product note (e.g. preparation form) when it should appear on the item row; recipe-specific prep often belongs in `recipe.recipe_ingredients.comment` instead (see §6).

### `common.ingredient_measurements`

Units for recipe lines (teaspoon, cup, `each`, etc.). The `name` column is matched in SQL **exactly** (PostgreSQL string comparison is case-sensitive). Before inserting new units, query what you already have so imports stay consistent:

```sql
SELECT name FROM common.ingredient_measurements ORDER BY name;
```

When you must add a row, supply `to_grams` when you know a sensible conversion for shopping or nutrition; otherwise `NULL` is fine for count-only units (e.g. cloves, each).

```sql
INSERT INTO common.ingredient_measurements (name, to_grams) VALUES
('Teaspoon', 5.00),
('cloves', NULL)
ON CONFLICT (name) DO NOTHING;
```

### `recipe.recipe_ingredients`

Links a recipe to items and amounts. Primary key is `(recipe_id, ingredient_id)` — **each item can appear at most once per recipe**. If the source lists the same ingredient twice, combine quantities (possibly after normalizing units) into one row.

| Column           | Notes |
|------------------|--------|
| `recipe_id`      | Use `currval('recipe.recipe_id_seq')` after the preceding `recipe.recipe` insert |
| `ingredient_id`  | `public.items.id` |
| `qty`            | Numeric amount |
| `measurement_id` | From `common.ingredient_measurements` via join on `name` |
| `comment`        | Optional; omit to default |
| `is_optional`    | Optional; defaults to `false` |

Foreign keys: `ingredient_id` → `public.items(id)`; `measurement_id` → `common.ingredient_measurements(id)`.

## 2. Mapping recipe text to measurement names

Recipes use abbreviations and mixed casing. Your `VALUES` list must use the **exact** `common.ingredient_measurements.name` string you will join on — either an existing row or a new one you insert first.

**Preferred canonical names** (use these when adding new measurements so imports stay uniform):

| Recipe text / abbreviation | Use in SQL as `measurement_name` |
|----------------------------|----------------------------------|
| t, tsp, tsp., Tsp, TSP | `Teaspoon` |
| T, tbsp, Tbsp, TBSP, Tbs, tbs | `Tablespoon` |
| c, C, cup, cups | `Cup` |
| fl oz, fl. oz., fluid ounce | `Fluid Ounce` (or match your existing fluid-ounce row) |
| oz (weight), ounce, ounces | `Ounce` |
| lb, lbs, #, pound, pounds | `Pound` |
| g, gram, grams | `Gram` |
| kg, kilogram, kilograms | `Kilogram` |
| ml, mL, milliliter | `Milliliter` |
| l, L, liter, litres | `Liter` |
| pinch, pinches | `pinch` |
| dash, dashes | `dash` |
| each, whole, item | `each` |
| clove, cloves | `cloves` |
| can, cans | `can` |
| jar | `jar` |
| slice, slices | `slices` |
| package, pkg, packet | `package` |
| rib, ribs | `ribs` |
| large, medium, small (e.g. “1 large egg”) | Often modeled as `each` with qty `1`, or a descriptive name like `large` if you add that unit |

If your database already uses different spellings (for example `tsp` and `Teaspoon` both exist), pick **one** row per real unit and use that name in imports; do not rely on abbreviations in SQL unless that exact string exists in `common.ingredient_measurements`.

## 3. Import workflow

1. **Measurements** — Query existing names; insert only missing units, using the mapping table above for new rows.
2. **Items** — Insert any ingredient names not already in `public.items`.
3. **Recipe** — `INSERT INTO recipe.recipe (name, servings, instructions) VALUES (...);`  
   The sequence is advanced by this insert, so `currval('recipe.recipe_id_seq')` is valid immediately after (same session).
4. **Lines** — `INSERT INTO recipe.recipe_ingredients (...) SELECT ...` using the pattern below. Include **`comment`** when the source specifies preparation (minced, chopped, etc.) that should not be part of the catalog `name`.

### Ingredient rows pattern

Use a `VALUES` list with columns `(qty_val, measurement_name, item_name)` and optional **`comment_text`**, alias it, and join to `items` and `common.ingredient_measurements` on names:

```sql
INSERT INTO recipe.recipe_ingredients (recipe_id, ingredient_id, qty, measurement_id, comment)
SELECT
    currval('recipe.recipe_id_seq'),
    items.id,
    recipe_data.qty_val,
    measurements.id,
    NULLIF(recipe_data.comment_text, '')
FROM (
    VALUES
    (1.00, 'Cup', 'All-purpose flour', NULL),
    (2.00, 'each', 'Eggs', NULL),
    (3.00, 'Teaspoon', 'Garlic', 'minced')
) AS recipe_data(qty_val, measurement_name, item_name, comment_text)
JOIN public.items items ON items.name = recipe_data.item_name
JOIN common.ingredient_measurements measurements ON measurements.name = recipe_data.measurement_name;
```

Omit the `comment` column from the `INSERT` list if you are not using comments; the minimal **three-column** `VALUES` pattern in §4 remains valid.

## 4. Full example (single recipe)

```sql
-- Measurements not already present (names unique)
INSERT INTO common.ingredient_measurements (name, to_grams) VALUES
('Cup', NULL),
('each', NULL)
ON CONFLICT (name) DO NOTHING;

-- Items not already present
INSERT INTO public.items (name, department) VALUES
('All-purpose flour', NULL),
('Eggs', NULL)
ON CONFLICT (name) DO NOTHING;

-- Recipe
INSERT INTO recipe.recipe (name, servings, instructions) VALUES
('Example Pancakes', 4, 'Mix dry ingredients. Whisk eggs and milk. Combine and cook.');

-- Ingredient lines (same session, immediately after recipe insert)
INSERT INTO recipe.recipe_ingredients (recipe_id, ingredient_id, qty, measurement_id)
SELECT currval('recipe.recipe_id_seq'), items.id, qty_val, measurements.id
FROM (
    VALUES
    (1.00, 'Cup', 'All-purpose flour'),
    (2.00, 'each', 'Eggs')
) AS recipe_data(qty_val, measurement_name, item_name)
JOIN public.items items ON items.name = recipe_data.item_name
JOIN common.ingredient_measurements measurements ON measurements.name = recipe_data.measurement_name;
```

## 5. Checklist from text recipe → SQL

1. Parse **servings** as an integer (use a placeholder if the text only says “serves a crowd”).
2. Normalize **ingredient names** to match `public.items.name` exactly (including punctuation and spacing).
3. Normalize **units** using the mapping table and `SELECT name FROM common.ingredient_measurements`; insert missing units with consistent names.
4. Build the **`VALUES` list**: `(qty, 'measurement_name', 'item_name')` — quantity is numeric; strings must match catalog rows exactly.
5. Ensure **no duplicate `item_name`** in the list for one recipe, or merge rows.
6. Run **recipe insert**, then **recipe_ingredients insert** in order (same connection/session so `currval` refers to the new recipe).

For AI-assisted batch imports, normalization of names, comments, departments, and the reference scripts, see **§6** and **§7**.

For several recipes in one script, repeat the recipe insert and ingredients insert for each; each `INSERT INTO recipe.recipe` advances `recipe.recipe_id_seq`, so each following `recipe_ingredients` block links to the recipe just inserted.

---

## 6. AI-assisted batch import (Recipe/Text tooling)

This repo includes a **generator pipeline** used to turn many plain-text files under `Recipe/Text/` into a single SQL script. Use it as a **reference implementation** when building or reviewing AI-generated imports: the same rules (canonical names, uniqueness, comments, departments) apply whether SQL is hand-written or produced by automation.

### 6.1 Layout

| Path | Role |
|------|------|
| `Recipe/Text/*.txt` | Source recipes (full text → `recipe.instructions`). |
| `scripts/recipe-ingredients-data.mjs` | Per-file metadata: display `name`, `servings`, and ingredient rows `[qty, measurementName, rawIngredientString]`. |
| `scripts/item-normalize.mjs` | Maps each **raw** ingredient string to a **canonical** `public.items.name`, optional **comment** (prep / text after comma), and a **category** used for department SQL. |
| `scripts/department-sql.mjs` | Emits `COALESCE((SELECT department FROM items WHERE name = '…'), …, (SELECT id FROM common.department WHERE name ILIKE '…'), …)` chains so new items inherit aisles from **existing exemplar items** (e.g. `Fresh Ginger`, `Garlic`, `Yellow Onion`) and fall back to **department names** in `common.department`. |
| `scripts/generate-text-recipes-sql.mjs` | Reads every `.txt` file, merges duplicate lines per recipe, writes **`sql/import-text-recipes.sql`**. |

Regenerate after editing data or normalization:

```bash
node kitchenhub/RecipeImportTooling/scripts/generate-text-recipes-sql.mjs
```

### 6.2 Rules for AI normalization (catalog + recipe lines)

1. **One row per item per recipe** — `PRIMARY KEY (recipe_id, ingredient_id)`. After normalizing names, **merge** duplicate lines that map to the same item: same measurement → sum `qty` and join comments; different measurements → one row with a combined **comment** describing both amounts (or split into distinct catalog names if they are truly different products, e.g. garlic vs garlic powder).

2. **Canonical `items.name`** — Short, stable, **unique in the catalog** (≤ 80 characters). Prefer matching **existing** `items.name` in the target database when you have a list or export. Merge obvious variants via an **alias table** (e.g. multiple “chicken broth” strings → one `Chicken broth`).

3. **Comma-separated phrasing** — If the source is like `Garlic, minced` or `Cheddar cheese, shredded`:
   - **Base name** → `items.name` (e.g. `Garlic`, `Cheddar cheese`).
   - **Trailing phrase** → `recipe.recipe_ingredients.comment` for that line (e.g. `minced`, `shredded`). Optionally copy the **first** such phrase into `items.details` for a one-time import if you want a default note on the pantry row.

4. **Fresh vs dried / ground** — Do not collapse unlike products (e.g. **Fresh Ginger** vs **Ginger, ground**). Align fresh ginger with an existing item name such as **Fresh Ginger** if the database already uses it.

5. **Departments** — Prefer `COALESCE` from **existing items’** `department` values, then `common.department` name patterns (`ILIKE`), not hard-coded IDs, so imports survive different department id sequences. If no exemplar matches, `NULL` is acceptable.

6. **`ON CONFLICT (name) DO NOTHING`** on `items` — Existing rows are **not** updated; plan a separate `UPDATE` or upsert if you must refresh `department`/`details` on collisions.

### 6.3 Measurements to add beyond §2

Batch imports may introduce units such as **`Quart`**, **`Gram`**, **`Milliliter`**, **`Liter`**, **`Fluid Ounce`**, **`sprig`** — add them to `common.ingredient_measurements` with the same `ON CONFLICT` pattern as other units.

### 6.4 What the generator outputs

- `BEGIN` / `COMMIT` transaction wrapper.
- `INSERT` for all required **measurement** names.
- `INSERT` for **normalized** `items` `(name, department, details)` with dynamic department expressions.
- For each recipe: `INSERT INTO recipe.recipe`, then `INSERT INTO recipe.recipe_ingredients` including **`comment`** where applicable, joined by **canonical** `item_name`.

### 6.5 When to duplicate this approach for new sources

For a **different** corpus (not `Recipe/Text/`), an AI should still:

1. Emit **one** curated ingredient list per recipe (or structured intermediate).
2. Normalize to **canonical names** + **comments**.
3. Resolve **departments** from the **live** `items` / `common.department` data when possible.
4. Emit SQL in **recipe → lines** order with `currval('recipe.recipe_id_seq')` in the same session.

The exact `.mjs` files are optional; the **rules in §6.2** are the contract for correct KitchenHub SQL.

## 7. AI checklist (extends §5)

1. **Uniqueness** — Recipe `name` ≤ 80 characters; disambiguate duplicate titles (e.g. append source filename).
2. **Ingredients** — No duplicate **canonical** `item_name` per recipe unless merged per §6.2.
3. **Comments** — Put preparation and comma-suffix text in **`recipe.recipe_ingredients.comment`** when it is line-specific.
4. **Existing DB** — Prefer matching **`items.name`** exactly to existing rows to avoid duplicate pantry entries and leverage existing departments.
5. **Validation** — After import, spot-check `recipe.recipe_ingredients` for `NULL` `measurement_id` (missing unit name) or failed joins (wrong `item_name`).
