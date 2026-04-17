BEGIN;

-- Departments
INSERT INTO common.department (name, ingredient) VALUES
  ('Produce', true),
  ('Bakery', true),
  ('Dairy', true),
  ('Meat & Seafood', true),
  ('Frozen', true),
  ('Pantry', true),
  ('Beverages', true),
  ('Household', false),
  ('Personal Care', false)
ON CONFLICT (name) DO NOTHING;

-- Shopping measurements
INSERT INTO common.measurements (name, to_grams) VALUES
  ('g', 1.00),
  ('kg', 1000.00),
  ('oz', 28.35),
  ('lb', 453.59),
  ('ml', 1.00),
  ('cup', 240.00),
  ('tbsp', 15.00),
  ('tsp', 5.00),
  ('each', NULL)
ON CONFLICT (name) DO NOTHING;

-- Stores
INSERT INTO store (name) VALUES
  ('FreshMart'),
  ('CostSaver')
ON CONFLICT (name) DO NOTHING;

-- Store zones
INSERT INTO storezones (storeid, zonesequence, zonename, departmentid)
SELECT s.id, z.zonesequence, z.zonename, d.id
FROM store s
JOIN (
  VALUES
    ('FreshMart', 1, 'Entry Produce', 'Produce'),
    ('FreshMart', 2, 'Bakery Wall', 'Bakery'),
    ('FreshMart', 3, 'Center Aisles', 'Pantry'),
    ('FreshMart', 4, 'Back Refrigerated', 'Dairy'),
    ('FreshMart', 5, 'Rear Right', 'Meat & Seafood'),
    ('FreshMart', 6, 'Far Left Freezers', 'Frozen'),
    ('FreshMart', 7, 'Front Endcaps', 'Beverages'),
    ('CostSaver', 1, 'Bulk Produce', 'Produce'),
    ('CostSaver', 2, 'Dry Goods', 'Pantry'),
    ('CostSaver', 3, 'Cold Storage', 'Dairy'),
    ('CostSaver', 4, 'Protein Corner', 'Meat & Seafood'),
    ('CostSaver', 5, 'Home Aisle', 'Household')
) AS z(storename, zonesequence, zonename, department_name) ON s.name = z.storename
JOIN common.department d ON d.name = z.department_name
ON CONFLICT (storeid, zonesequence, departmentid) DO NOTHING;

-- Core shopping items
INSERT INTO items (
  name, department, qty, details, kcal, kcal_qty, kcal_measurement_id, shopping_measure,
  ingredient_unit_grams, count_per_pack, shopping_measure_grams
)
SELECT i.name, d.id, i.qty, i.details, i.kcal, i.kcal_qty, m.id, i.shopping_measure,
       i.ingredient_unit_grams, i.count_per_pack, i.shopping_measure_grams
FROM (
  VALUES
    ('Bananas', 'Produce', 6, 'Ripe and ready', 89, 100.00, 'g', 'each', 118.00, 1, 118.00),
    ('Baby Spinach', 'Produce', 1, '8oz clamshell', 23, 100.00, 'g', 'pack', 227.00, 1, 227.00),
    ('Sourdough Bread', 'Bakery', 1, 'Sliced loaf', 265, 100.00, 'g', 'loaf', 680.00, 1, 680.00),
    ('Greek Yogurt', 'Dairy', 2, 'Plain, 32oz tub', 59, 100.00, 'g', 'tub', 907.00, 1, 907.00),
    ('Chicken Breast', 'Meat & Seafood', 2, 'Boneless skinless', 165, 100.00, 'g', 'lb', 453.59, 1, 453.59),
    ('Frozen Broccoli', 'Frozen', 2, 'Steam-in-bag', 34, 100.00, 'g', 'bag', 340.00, 1, 340.00),
    ('Olive Oil', 'Pantry', 1, 'Extra virgin', 119, 15.00, 'ml', 'bottle', 750.00, 1, 750.00),
    ('Black Beans', 'Pantry', 4, '15oz cans', 114, 86.00, 'g', 'can', 425.00, 1, 425.00),
    ('Sparkling Water', 'Beverages', 2, '12-pack cans', 0, 355.00, 'ml', 'case', 4260.00, 12, 355.00),
    ('Dish Soap', 'Household', 1, 'Lemon scent', NULL, NULL, 'each', 'bottle', NULL, 1, NULL),
    ('Toothpaste', 'Personal Care', 2, 'Fluoride mint', NULL, NULL, 'each', 'tube', NULL, 1, NULL)
) AS i(
  name, department_name, qty, details, kcal, kcal_qty, measurement_name, shopping_measure,
  ingredient_unit_grams, count_per_pack, shopping_measure_grams
)
JOIN common.department d ON d.name = i.department_name
LEFT JOIN common.measurements m ON m.name = i.measurement_name
ON CONFLICT (name) DO NOTHING;

-- Recipe categories
INSERT INTO recipe.recipe_category (name) VALUES
  ('Weeknight'),
  ('Meal Prep'),
  ('Vegetarian'),
  ('High Protein')
ON CONFLICT (name) DO NOTHING;

-- Recipe measurements
INSERT INTO recipe.ingredient_measurement (name, to_grams) VALUES
  ('g', 1.00),
  ('kg', 1000.00),
  ('cup', 240.00),
  ('tbsp', 15.00),
  ('tsp', 5.00),
  ('each', NULL)
ON CONFLICT (name) DO NOTHING;

-- Recipe ingredients catalog
INSERT INTO recipe.ingredients (
  name, details, kcal, measurement_id, department_id, qty, shopping_measure, shopping_measure_grams
)
SELECT r.name, r.details, r.kcal, rm.id, d.id, r.qty, r.shopping_measure, r.shopping_measure_grams
FROM (
  VALUES
    ('Chicken Breast', 'Boneless skinless', 165, 'g', 'Meat & Seafood', 100.00, 'lb', 453.59),
    ('Brown Rice', 'Long grain', 111, 'g', 'Pantry', 100.00, 'bag', 907.00),
    ('Broccoli', 'Fresh florets', 34, 'g', 'Produce', 100.00, 'head', 300.00),
    ('Garlic', 'Minced', 149, 'g', 'Produce', 100.00, 'bulb', 60.00),
    ('Olive Oil', 'Extra virgin', 119, 'tbsp', 'Pantry', 1.00, 'bottle', 750.00),
    ('Greek Yogurt', 'Plain', 59, 'g', 'Dairy', 100.00, 'tub', 907.00),
    ('Blueberries', 'Fresh', 57, 'g', 'Produce', 100.00, 'pint', 340.00)
) AS r(name, details, kcal, measurement_name, department_name, qty, shopping_measure, shopping_measure_grams)
LEFT JOIN recipe.ingredient_measurement rm ON rm.name = r.measurement_name
JOIN common.department d ON d.name = r.department_name
ON CONFLICT (name, details) DO NOTHING;

-- Recipes
INSERT INTO recipe.recipe (name, servings, instructions)
VALUES
  (
    'Sheet Pan Lemon Chicken',
    4,
    'Toss chicken and broccoli with oil, garlic, salt, and pepper. Roast at 425F for 22 minutes. Serve with rice.'
  ),
  (
    'Berry Yogurt Parfait',
    2,
    'Layer Greek yogurt and blueberries. Chill for 10 minutes before serving.'
  ),
  (
    'Meal Prep Rice Bowls',
    5,
    'Cook rice, roast broccoli, pan-sear chicken, then portion into containers.'
  )
ON CONFLICT (name) DO NOTHING;

-- Recipe category members
INSERT INTO recipe.recipe_category_members (recipe_id, category_id)
SELECT r.id, c.id
FROM (
  VALUES
    ('Sheet Pan Lemon Chicken', 'Weeknight'),
    ('Sheet Pan Lemon Chicken', 'High Protein'),
    ('Berry Yogurt Parfait', 'Vegetarian'),
    ('Meal Prep Rice Bowls', 'Meal Prep'),
    ('Meal Prep Rice Bowls', 'High Protein')
) AS x(recipe_name, category_name)
JOIN recipe.recipe r ON r.name = x.recipe_name
JOIN recipe.recipe_category c ON c.name = x.category_name
ON CONFLICT (recipe_id, category_id) DO NOTHING;

-- Recipe ingredient links
INSERT INTO recipe.recipe_ingredients (recipe_id, ingredient_id, qty, measurement_id, comment, is_optional)
SELECT r.id, i.id, x.qty, rm.id, x.comment, x.is_optional
FROM (
  VALUES
    ('Sheet Pan Lemon Chicken', 'Chicken Breast', 'Boneless skinless', 700.00, 'g', 'Cut into strips', false),
    ('Sheet Pan Lemon Chicken', 'Broccoli', 'Fresh florets', 500.00, 'g', 'Large florets', false),
    ('Sheet Pan Lemon Chicken', 'Garlic', 'Minced', 3.00, 'each', 'Cloves', false),
    ('Sheet Pan Lemon Chicken', 'Olive Oil', 'Extra virgin', 2.00, 'tbsp', 'For roasting', false),
    ('Meal Prep Rice Bowls', 'Brown Rice', 'Long grain', 2.00, 'cup', 'Dry volume', false),
    ('Meal Prep Rice Bowls', 'Chicken Breast', 'Boneless skinless', 900.00, 'g', 'Season lightly', false),
    ('Meal Prep Rice Bowls', 'Broccoli', 'Fresh florets', 600.00, 'g', 'Steam or roast', false),
    ('Berry Yogurt Parfait', 'Greek Yogurt', 'Plain', 400.00, 'g', NULL, false),
    ('Berry Yogurt Parfait', 'Blueberries', 'Fresh', 180.00, 'g', NULL, false)
) AS x(recipe_name, ingredient_name, ingredient_details, qty, measurement_name, comment, is_optional)
JOIN recipe.recipe r ON r.name = x.recipe_name
JOIN recipe.ingredients i ON i.name = x.ingredient_name AND i.details = x.ingredient_details
LEFT JOIN recipe.ingredient_measurement rm ON rm.name = x.measurement_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- App settings
INSERT INTO config.settings (key, value) VALUES
  ('default_store', 'FreshMart'),
  ('shopping_sort_mode', 'store_zone'),
  ('show_recipe_nutrition', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;
