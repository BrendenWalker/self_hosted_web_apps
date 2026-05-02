-- KitchenHub: single schema file (common + main app + recipe)
-- Run once per database: psql -U postgres -d kitchenhub -f kitchenhub/database/schema.sql

-- Department table
CREATE SCHEMA IF NOT EXISTS common;

CREATE TABLE IF NOT EXISTS common.department (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    ingredient BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_common_department_name ON common.department(name);

-- ========== MAIN APP ==========
CREATE TABLE IF NOT EXISTS store (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storezones (
    storeid INTEGER NOT NULL REFERENCES store(id) ON DELETE CASCADE,
    zonesequence INTEGER NOT NULL,
    zonename VARCHAR(80) NOT NULL,
    departmentid INTEGER NOT NULL REFERENCES common.department(id) ON DELETE CASCADE,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (storeid, zonesequence, departmentid)
);
CREATE INDEX IF NOT EXISTS idx_storezones_storeid ON storezones(storeid);
CREATE INDEX IF NOT EXISTS idx_storezones_deptid ON storezones(departmentid);

-- Ingredient / nutrition fields on items (see migrations 008+ for existing DBs).
CREATE TABLE IF NOT EXISTS common.measurements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    to_grams NUMERIC(10, 2)
);
CREATE INDEX IF NOT EXISTS idx_common_measurements_name ON common.measurements(name);

CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    department INTEGER NOT NULL REFERENCES common.department(id),
    qty REAL DEFAULT 0,
    details VARCHAR(255),
    kcal INTEGER,
    kcal_qty NUMERIC(10, 2),
    kcal_measurement_id INTEGER REFERENCES common.measurements(id) ON DELETE SET NULL,
    shopping_measure VARCHAR(255),
    ingredient_unit_grams NUMERIC(10, 2),
    count_per_pack INTEGER,
    shopping_measure_grams NUMERIC(10, 2),
    usda_fdc_id INTEGER,
    usda_data_type TEXT,
    usda_description TEXT,
    nutrition_synced_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_items_department ON items(department);
CREATE INDEX IF NOT EXISTS idx_items_kcal_measurement_id ON items(kcal_measurement_id);
CREATE INDEX IF NOT EXISTS idx_items_usda_fdc_id ON items(usda_fdc_id);

-- ========== CONFIG ==========
CREATE SCHEMA IF NOT EXISTS config;

CREATE TABLE IF NOT EXISTS config.settings (
    key VARCHAR(255) NOT NULL PRIMARY KEY,
    value TEXT
);

-- ========== RECIPE ==========
CREATE SCHEMA IF NOT EXISTS recipe;

CREATE TABLE IF NOT EXISTS recipe.recipe_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    schedulable BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_recipe_category_name ON recipe.recipe_category(name);

CREATE TABLE IF NOT EXISTS recipe.recipe (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    servings INTEGER NOT NULL,
    instructions TEXT,
    image BYTEA,
    schedulable BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_recipe_name ON recipe.recipe(name);

CREATE TABLE IF NOT EXISTS recipe.recipe_category_members (
    recipe_id INTEGER NOT NULL REFERENCES recipe.recipe(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES recipe.recipe_category(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_category_members_recipe ON recipe.recipe_category_members(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_category_members_category ON recipe.recipe_category_members(category_id);

CREATE TABLE IF NOT EXISTS recipe.ingredient_measurement (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    to_grams NUMERIC(10, 2)
);
CREATE INDEX IF NOT EXISTS idx_ingredient_measurement_name ON recipe.ingredient_measurement(name);

CREATE TABLE IF NOT EXISTS recipe.ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    details VARCHAR(255),
    kcal INTEGER,
    measurement_id INTEGER REFERENCES recipe.ingredient_measurement(id) ON DELETE SET NULL,
    department_id INTEGER NOT NULL REFERENCES common.department(id) ON DELETE CASCADE,
    qty NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    shopping_measure VARCHAR(255),
    shopping_measure_grams NUMERIC(10, 2),
    CONSTRAINT ingredients_name_details_unique UNIQUE (name, details)
);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON recipe.ingredients(name);
CREATE INDEX IF NOT EXISTS idx_ingredients_department ON recipe.ingredients(department_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_measurement ON recipe.ingredients(measurement_id);

CREATE TABLE IF NOT EXISTS recipe.recipe_ingredients (
    recipe_id INTEGER NOT NULL REFERENCES recipe.recipe(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES recipe.ingredients(id) ON DELETE CASCADE,
    qty NUMERIC(10, 2),
    measurement_id INTEGER REFERENCES recipe.ingredient_measurement(id) ON DELETE SET NULL,
    comment VARCHAR(255),
    is_optional BOOLEAN DEFAULT false NOT NULL,
    PRIMARY KEY (recipe_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe.recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_measurement ON recipe.recipe_ingredients(measurement_id);

-- ========== MEAL PLANNER ==========
CREATE SCHEMA IF NOT EXISTS mealplanner;

CREATE TABLE IF NOT EXISTS mealplanner.meals (
    id SERIAL PRIMARY KEY,
    meal_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meal_slot_id INTEGER NOT NULL DEFAULT 4,
    recipe_id INTEGER NOT NULL REFERENCES recipe.recipe(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mealplanner_meals_meal_date ON mealplanner.meals(meal_date);
CREATE INDEX IF NOT EXISTS idx_mealplanner_meals_recipe_id ON mealplanner.meals(recipe_id);
