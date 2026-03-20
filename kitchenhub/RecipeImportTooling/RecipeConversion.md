``` 
# Recipe Database Migration Guide

This guide outlines the assumed table structures and the corrected SQL syntax to migrate your recipe documents into a PostgreSQL database, respecting the `SERIAL` data type for auto-generated IDs.

## 1. Assumed Database Schema

Based on your `DATABASE_INFO.txt` and the required relationships, the following schema definitions are assumed for the missing tables.

### Recipe Table (`recipe.recipe`)

This table stores the high-level information for each recipe. The `id` is a `SERIAL` primary key and should be omitted from `INSERT` statements.

```sql
CREATE TABLE recipe.recipe (
    id SERIAL4 NOT NULL,
    name VARCHAR(255) NOT NULL,
    servings VARCHAR(50),
    instructions TEXT,
    image VARCHAR(255),
    comments TEXT,
    CONSTRAINT recipe_pkey PRIMARY KEY (id)
); 
```

Recipe Ingredients Table (`recipe.recipe_ingredients`)

This table links a recipe to its ingredients, quantity, and measurement.

```sql
CREATE TABLE recipe.recipe_ingredients (
    recipe_id INT4 NOT NULL,
    item_id INT4 NOT NULL,
    quantity NUMERIC(10, 2),
    measurement_id INT4,
    CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (recipe_id, item_id),
    -- Foreign Keys for linking
    CONSTRAINT fk_recipe FOREIGN KEY (recipe_id) REFERENCES recipe.recipe(id),
    CONSTRAINT fk_item FOREIGN KEY (item_id) REFERENCES public.items(id),
    CONSTRAINT fk_measurement FOREIGN KEY (measurement_id) REFERENCES common.ingredient_measurements(id)
); 
```

-----

## 2. SQL Migration Syntax for Future Recipes

When migrating new recipes, follow these steps to insert data, omitting the `id` column for `SERIAL` fields and using the `currval()` function to link tables.

### Step 2A: Insert New Items and Measurements

For any new ingredients or measurements, insert them using the following format.

```sql
-- INSERT NEW MEASUREMENTS (name must be unique)
INSERT INTO common.ingredient_measurements (name, to_grams) VALUES
('teaspoon', 5.00),
('cloves', NULL),
('package', NULL)
ON CONFLICT (name) DO NOTHING;

-- INSERT NEW ITEMS (name must be unique)
INSERT INTO public.items (name, department) VALUES
('New Ingredient Name', 99), -- Use a relevant department ID
('Another Ingredient', 99)
ON CONFLICT (name) DO NOTHING; 
```

### Step 2B: Insert Recipe and Ingredients (Linked)

Use this two-part query structure for each recipe. The `currval('recipe.recipe_id_seq')` function ensures ingredients are correctly linked to the new recipe ID.

```sql
-- *** 1. INSERT THE MAIN RECIPE ***
-- Omit the 'id' column for auto-generation
INSERT INTO recipe.recipe (name, servings, instructions, comments) VALUES
('The New Recipe Name', 
 '4 servings', 
 'Step 1: Do this. Step 2: Do that.', 
 'Optional notes about the recipe.') 
RETURNING id; -- Returns the new ID

-- *** 2. INSERT INGREDIENTS AND LINK TO THE NEW RECIPE ***
INSERT INTO recipe.recipe_ingredients (recipe_id, item_id, quantity, measurement_id)
SELECT 
    currval('recipe.recipe_id_seq'), -- Automatically uses the ID from the previous INSERT
    items.id, 
    recipe_data.quantity_val, 
    measurements.id 
FROM 
(
    -- List the ingredient data as it appears in the source document: (Quantity, Measurement Name, Item Name)
    VALUES
    (1.00, 'Cup', 'Flour, All-Purpose'), 
    (2.00, 'each', 'Eggs'),
    (0.50, 'Teaspoon', 'Salt')
) AS recipe_data(quantity_val, measurement_name, item_name)
-- Join to look up the ID for the Item Name
JOIN public.items items ON items.name = recipe_data.item_name
-- Join to look up the ID for the Measurement Name
JOIN common.ingredient_measurements measurements ON measurements.name = recipe_data.measurement_name; 
```

-----

## Example: Tamale Recipe Migration

This example shows the full process for one of the previous recipes:

```sql
-- Ensure all necessary items and measurements for this recipe exist (Step 2A)
INSERT INTO common.ingredient_measurements (name, to_grams) VALUES
('Cup', 185.00), -- Assuming these base units are already done
('Tablespoon', 15.00),
('Teaspoon', 5.00),
('Pound', 453.59),
('Ounce', 28.35),
('cloves', NULL),
('package', NULL)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.items (name, department) VALUES
('Chicken', 99),
('Chili Powder', 99),
('Cumin Seeds, freshly toasted and ground', 99),
('Cayenne Pepper', 99),
('Dried Oregano', 99),
('Kosher Salt', 99),
('Black Pepper, fresh ground', 99),
('Masa Harina', 99),
('Baking Powder', 99),
('Lard', 99)
ON CONFLICT (name) DO NOTHING;

-- *** 1. INSERT THE MAIN RECIPE ***
INSERT INTO recipe.recipe (name, instructions) VALUES
('Hot and Mild Chicken Tamales', 
 'Cook meat: 
 Place 3 lbs chicken, 3 tsp chili powder, 2 1/4 tsp cumin seeds, 1 1/2 tsp cayenne, 1 1/2 tsp oregano, 1 1/2 tsp salt, 1 1/2 tsp pepper into large pot and cover with water (~3.75 quarts). Bring to boil, reduce to low and simmer 1.5-2 hours until falling apart. Remove meat and stock.

Mild Filling:
 Shred meat. Sauté 1/2 onion in 3 Tbsp oil until semi-translucent. Add 2 cloves garlic, mild chilis, cook 1 min. Add meat and 1/3 cup cooking liquid until heated through.

Hot Filling:
 Sauté 1/2 onion in 3 Tbsp oil. Add 2 cloves garlic, jalapeño, 2 tsp salt, 1 tsp paprika, 1 tsp SMOKED paprika, 1 tsp garlic powder, 1 tsp onion powder, 1/2 tsp cayenne, 1/4 tsp cumin. Add meat and moisten with cooking liquid.

Dough:
 Mix 7 cups masa harina, 2 Tbsp salt, 4 1/2 tsp baking powder. Knead in 8 oz lard. Gradually add 4-8 cups reserved cooking liquid until dough is like thick mashed potatoes. Cover with damp towel.

Assemble & Steam:
 Soak wrappers for 45 mins - 2 hours. Spread 2 Tbsp dough on wide end of husk, within 1/2 inch of edges. Spoon 2 tsp meat down center. Roll husk, fold bottom. Steam in a pot with water at the bottom of the basket, standing tamales upright.
') 
RETURNING id; 

-- *** 2. INSERT INGREDIENTS ***
INSERT INTO recipe.recipe_ingredients (recipe_id, item_id, quantity, measurement_id)
SELECT 
    currval('recipe.recipe_id_seq'), 
    items.id, 
    recipe_data.quantity_val, 
    measurements.id 
FROM 
(
    VALUES
    (3.00, 'Pound', 'Chicken'),
    (3.00, 'Teaspoon', 'Chili Powder'),
    (2.25, 'Teaspoon', 'Cumin Seeds, freshly toasted and ground'),
    (1.50, 'Teaspoon', 'Cayenne Pepper'),
    (1.50, 'Teaspoon', 'Dried Oregano'),
    (1.50, 'Teaspoon', 'Kosher Salt'),
    (1.50, 'Teaspoon', 'Black Pepper, fresh ground'),
    (7.00, 'Cup', 'Masa Harina'),
    (2.00, 'Tablespoon', 'Kosher Salt'), -- for dough, re-used item
    (4.50, 'Teaspoon', 'Baking Powder'),
    (8.00, 'Ounce', 'Lard')
) AS recipe_data(quantity_val, measurement_name, item_name)
JOIN public.items items ON items.name = recipe_data.item_name
JOIN common.ingredient_measurements measurements ON measurements.name = recipe_data.measurement_name;  
```

```