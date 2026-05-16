---
name: kitchenhub-recipe-ingest
description: >-
  Parses plain-text recipes into KitchenHub PostgreSQL import SQL. Validates
  ingredients and measurements against the live database before emitting recipe
  SQL; flags missing catalog rows; prompts for recipe categories. Use when the
  user imports a recipe, pastes recipe text, asks for KitchenHub recipe SQL, or
  invokes @kitchenhub-recipe-ingest.
disable-model-invocation: true
---

# KitchenHub recipe ingest

Import one recipe at a time into KitchenHub (`recipe` schema + `public.items`). **Do not emit recipe SQL until validation passes and the user has chosen categories.**

## Critical rules (never break)

1. **Never insert into the database** — no `INSERT INTO public.items`, no `INSERT INTO common.measurements`, no ad-hoc Node/pg scripts, no KitchenHub API calls to create catalog rows. The user (or SQL they run manually) owns catalog changes.
2. **Never silently map missing items** — even when a close match exists (e.g. `Olive oil` → `Olive Oil`), **stop and ask** which catalog name to use.
3. **Never proceed past a failed validator** — exit code `1` means STOP; do not run `emit-recipe-sql.mjs`, do not ask for categories yet, do not “fix” the DB yourself.
4. **Never put `raw` in parsed JSON if `item` is already set** — `raw` is only for ingredient text without qty/unit; including full lines breaks normalization.

Full schema rules: [kitchenhub/RecipeImportTooling/RecipeConversion.md](kitchenhub/RecipeImportTooling/RecipeConversion.md). Quick reference: [reference.md](reference.md).

## Prerequisites

- KitchenHub Postgres reachable with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (same as backend; optional `kitchenhub/backend/.env`).
- Run scripts from repo root:

```bash
node kitchenhub/RecipeImportTooling/scripts/validate-recipe-import.mjs ...
node kitchenhub/RecipeImportTooling/scripts/emit-recipe-sql.mjs ...
```

## Phase A — Parse recipe text

**Input:** pasted text or `kitchenhub/RecipeImportTooling/recipes-inbox/*.txt`.

1. **Title** — first line or line before description; strip leading `N.` (e.g. `14. Scented Pork Stir-Fry` → `Scented Pork Stir-Fry`); max 80 characters.
2. **Servings** — `Serving size: N` / `Serves N` → integer (default `4`).
3. **Cooking time** — no DB column; optionally prefix `instructions` with `Cooking time: …` or omit.
4. **Ingredients** — lines between `Ingredients:` and `Instructions:`.
5. **Instructions** — text after `Instructions:` through end of file.

**Line cleanup:**

- Split glued quantities (`1/2 teaspoon salt1/2 teaspoon` → two lines).
- Parse `qty`, unit, item; support fractions (`1/2`), decimals, ranges on qty where needed.
- Lines like `Hot, cooked rice for serving` — ask user: omit, optional garnish, or catalog line.

**Normalize each ingredient** using rules in `kitchenhub/RecipeImportTooling/scripts/item-normalize.mjs` (import `normalizeIngredient` logic or apply alias table from reference.md):

- Comma prep → `item` + `comment` (e.g. `Garlic, minced` → item `Garlic`, comment `minced`).
- Canonical `items.name` ≤ 80 chars; stable and unique per product.
- Map units via [reference.md](reference.md) measurement table (`tbsp` → `Tablespoon`, `lb.` → `Pound`, etc.).
- **Merge** duplicate canonical items per recipe (sum qty if same unit; else combine comments).

Write intermediate JSON (suggested path: `kitchenhub/RecipeImportTooling/recipes-inbox/parsed-<slug>.json`):

```json
{
  "name": "Scented Pork Stir-Fry",
  "servings": 4,
  "instructions": "Bring a pot of lightly salted water to a boil.\n...",
  "ingredients": [
    { "qty": 3, "measurement": "Cup", "item": "Green beans", "comment": "trimmed" }
  ]
}
```

Optional: `"raw": "fresh green beans, trimmed"` **only when** `item` is omitted — never the full line with qty/unit.

## Phase B — Validate (mandatory gate)

```bash
node kitchenhub/RecipeImportTooling/scripts/validate-recipe-import.mjs path/to/parsed.json --json
```

List categories when needed:

```bash
node kitchenhub/RecipeImportTooling/scripts/validate-recipe-import.mjs --list-categories
```

**If exit code ≠ 0:** go to **Phase B2** immediately. Do not continue to categories or SQL.

**Do not** include new `items` or `measurements` INSERTs in the final recipe SQL file.

## Phase B2 — User decisions for missing catalog rows (mandatory when validation fails)

When `ok` is false or `requiresUserDecision` is true in JSON output, **STOP and ask the user**. Use **AskQuestion** (or a clear numbered list in chat) — one decision per missing item and per missing measurement.

For each **missing item**, present:

| Field | Source |
|-------|--------|
| Parsed name | `items[].name` from validate JSON |
| Recipe context | qty, unit, comment from `ingredients` |
| Suggestions | `items[].suggestions` (exact DB names) |
| Optional new item | `items[].draftSql` — show as *example only*; user runs it themselves if they choose “create new” |

Ask the user to pick **one** action per missing line:

1. **Map** — use an existing `items.name` from suggestions (or another name they specify). Update `parsed.json` `item` to that **exact** string, then re-validate.
2. **Create** — user will add a new pantry item themselves (UI or by running `draftSql` you showed). Wait for them to confirm, then re-validate.
3. **Omit** — drop the line from the recipe (update `parsed.json`). Re-validate.

For each **missing measurement**, ask: map to an existing unit (list from DB if needed) or create via separate SQL the user runs manually.

**Forbidden while `ok` is false:**

- Running `draftSql` or any INSERT yourself
- Auto-picking the “closest” suggestion without user confirmation
- Updating `parsed.json` and re-validating in the same turn without user input
- Calling `emit-recipe-sql.mjs`
- Asking for recipe categories (Phase C comes only after `ok: true`)

After the user responds, apply their choices to `parsed.json`, re-run validate, and repeat Phase B2 until `"ok": true`.

## Phase C — Categories (mandatory; only after `ok: true`)

1. Run `--list-categories` or use categories from validate JSON output.
2. Ask the user to pick **one or more** existing category names (use AskQuestion when available).
3. If they want a **new** category, pass it to emit via `--new-categories` (not only `--categories`).

## Phase D — Emit recipe SQL

Only after Phase B passes and categories are chosen:

```bash
node kitchenhub/RecipeImportTooling/scripts/emit-recipe-sql.mjs path/to/parsed.json \
  --categories "Weeknight,Asian" \
  --new-categories "Stir-Fry"
```

Default output: `kitchenhub/RecipeImportTooling/sql/import-single-<slug>.sql`

Remind the user to run the SQL in psql/DBeaver against their KitchenHub database. **Do not execute SQL automatically.**

## Phase E — Post-check

After the user runs the SQL, they can verify:

```sql
SELECT ri.*, i.name AS item_name, m.name AS measurement_name
FROM recipe.recipe_ingredients ri
JOIN recipe.recipe r ON r.id = ri.recipe_id
LEFT JOIN public.items i ON i.id = ri.ingredient_id
LEFT JOIN common.measurements m ON m.id = ri.measurement_id
WHERE r.name = 'Recipe Name'
  AND (ri.ingredient_id IS NULL OR ri.measurement_id IS NULL);
```

Empty result = good joins.

## Not in scope

- Batch import of `Recipe/Text/` — use `generate-text-recipes-sql.mjs` instead.
- KitchenHub REST API — SQL-first workflow only.
- Auto-inserting missing ingredients into recipe SQL or the database.
- Agent-executed catalog fixes (including temporary helper scripts that INSERT into `items`).

## Workflow summary

```text
Parse → parsed.json → validate
  → if missing: ASK user (map | create | omit) → update JSON → validate again
  → when ok: ASK categories → emit-recipe-sql → user runs .sql
```
