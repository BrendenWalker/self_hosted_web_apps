-- KitchenHub: single schema file (common + main app + recipe)
-- Run once per database: psql -U postgres -d hausfrau -f kitchenhub/database/schema.sql

-- ========== COMMON ==========
CREATE SCHEMA IF NOT EXISTS common;

CREATE TABLE IF NOT EXISTS common.department (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
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

CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    department INTEGER REFERENCES common.department(id),
    qty REAL DEFAULT 0,
    changed INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_department ON items(department);
CREATE INDEX IF NOT EXISTS idx_items_changed ON items(changed);

CREATE TABLE IF NOT EXISTS shopping_list (
    name VARCHAR(80) NOT NULL PRIMARY KEY,
    department_id INTEGER REFERENCES common.department(id),
    description VARCHAR(80),
    quantity VARCHAR(80),
    purchased INTEGER DEFAULT 0,
    item_id INTEGER REFERENCES items(id),
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shopping_list_dept ON shopping_list(department_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_itemid ON shopping_list(item_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_purchased ON shopping_list(purchased);

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
    name VARCHAR(80) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_recipe_category_name ON recipe.recipe_category(name);

CREATE TABLE IF NOT EXISTS recipe.recipe (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    servings INTEGER NOT NULL,
    category_id INTEGER NOT NULL REFERENCES recipe.recipe_category(id) ON DELETE CASCADE,
    instructions TEXT,
    image BYTEA,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recipe_name ON recipe.recipe(name);
CREATE INDEX IF NOT EXISTS idx_recipe_category ON recipe.recipe(category_id);

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
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    option SMALLINT,
    PRIMARY KEY (recipe_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe.recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_measurement ON recipe.recipe_ingredients(measurement_id);
