-- Block deleting catalog items that are still referenced on recipe lines.
-- Replaces ON DELETE CASCADE with ON DELETE RESTRICT on recipe.recipe_ingredients → items.

ALTER TABLE recipe.recipe_ingredients
  DROP CONSTRAINT IF EXISTS recipe_ingredients_ingredient_id_fkey,
  DROP CONSTRAINT IF EXISTS recipe_recipe_ingredients_ingredient_id_fkey;

ALTER TABLE recipe.recipe_ingredients
  ADD CONSTRAINT recipe_ingredients_ingredient_id_fkey
  FOREIGN KEY (ingredient_id) REFERENCES items(id) ON DELETE RESTRICT;

-- Legacy: public.recipe_ingredients → public.items (see migration 008).
DO $$
BEGIN
  IF to_regclass('public.recipe_ingredients') IS NOT NULL THEN
    ALTER TABLE public.recipe_ingredients
      DROP CONSTRAINT IF EXISTS recipe_ingredients_ingredient_id_fkey;
    IF to_regclass('public.items') IS NOT NULL THEN
      ALTER TABLE public.recipe_ingredients
        ADD CONSTRAINT recipe_ingredients_ingredient_id_fkey
        FOREIGN KEY (ingredient_id) REFERENCES public.items(id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;
