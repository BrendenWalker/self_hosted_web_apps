# KitchenHub recipe ingest — reference

## Documentation

- [RecipeConversion.md](../../../kitchenhub/RecipeImportTooling/RecipeConversion.md) — full schema, batch import, normalization contract
- [item-normalize.mjs](../../../kitchenhub/RecipeImportTooling/scripts/item-normalize.mjs) — `normalizeIngredient(raw)` aliases
- [example_script.txt](../../../kitchenhub/RecipeImportTooling/example_script.txt) — sample SQL output

## Measurement aliases (recipe text → `common.measurements.name`)

| Recipe text / abbreviation | Use in SQL |
|----------------------------|------------|
| t, tsp, tsp., Tsp, TSP | `Teaspoon` |
| T, tbsp, Tbsp, TBSP, Tbs, tbs | `Tablespoon` |
| c, C, cup, cups | `Cup` |
| fl oz, fl. oz., fluid ounce | `Fluid Ounce` |
| oz, ounce, ounces | `Ounce` |
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

Script: `measurement-canonical.mjs` applies these before DB validation.

## Example: Scented Pork Stir-Fry (parsed JSON sketch)

After parsing the sample recipe, expect lines similar to (names must match **your** database):

```json
{
  "name": "Scented Pork Stir-Fry",
  "servings": 4,
  "instructions": "Bring a pot of lightly salted water to a boil.\n...",
  "ingredients": [
    { "qty": 3, "measurement": "Cup", "item": "Green beans", "comment": "trimmed" },
    { "qty": 1, "measurement": "Tablespoon", "item": "Olive oil", "comment": null },
    { "qty": 1, "measurement": "Tablespoon", "item": "Sesame oil", "comment": null },
    { "qty": 1, "measurement": "Pound", "item": "Pork tenderloin", "comment": "cut into thin strips" },
    { "qty": 0.5, "measurement": "Teaspoon", "item": "Salt", "comment": null },
    { "qty": 0.5, "measurement": "Teaspoon", "item": "Black pepper", "comment": null },
    { "qty": 2, "measurement": "Tablespoon", "item": "Soy sauce", "comment": null },
    { "qty": 1, "measurement": "Tablespoon", "item": "Rice vinegar", "comment": null },
    { "qty": 1, "measurement": "Teaspoon", "item": "Sugar", "comment": null },
    { "qty": 1, "measurement": "Tablespoon", "item": "Fresh Ginger", "comment": "grated" },
    { "qty": 2, "measurement": "Cup", "item": "Bok choy", "comment": "shredded" }
  ]
}
```

`Hot, cooked rice for serving` — typically omitted unless the user wants it cataloged.

**Gate behavior:** if `Pork tenderloin` is not in `public.items`, validation fails with `requiresUserDecision: true`. The agent must **ask** the user: map to a suggestion (e.g. `Pork Tenderloin`), create a new item (user runs optional `draftSql`), or omit the line. The agent must **not** INSERT into the database or auto-pick a mapping.

## CLI quick reference

```bash
# Validate
node kitchenhub/RecipeImportTooling/scripts/validate-recipe-import.mjs parsed.json --json

# List categories
node kitchenhub/RecipeImportTooling/scripts/validate-recipe-import.mjs --list-categories

# Emit SQL (after validate ok)
node kitchenhub/RecipeImportTooling/scripts/emit-recipe-sql.mjs parsed.json \
  --categories "Weeknight" --new-categories "Asian"
```
