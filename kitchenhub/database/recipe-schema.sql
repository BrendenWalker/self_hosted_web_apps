-- PostgreSQL Schema for Recipe Feature
-- Migrated from Firebird DDL
-- Uses recipe schema and references common.department

-- Create recipe schema
CREATE SCHEMA IF NOT EXISTS recipe;

-- Recipe category table
CREATE TABLE IF NOT EXISTS recipe.recipe_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_recipe_category_name ON recipe.recipe_category(name);

-- Recipe table
CREATE TABLE IF NOT EXISTS recipe.recipe (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    servings INTEGER NOT NULL,
    category_id INTEGER NOT NULL REFERENCES recipe.recipe_category(id) ON DELETE CASCADE,
    instructions TEXT,
    image BYTEA,  -- Binary image data
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Set once on creation
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Update on every modification
);

CREATE INDEX IF NOT EXISTS idx_recipe_name ON recipe.recipe(name);
CREATE INDEX IF NOT EXISTS idx_recipe_category ON recipe.recipe(category_id);

-- Ingredient measurement table
CREATE TABLE IF NOT EXISTS recipe.ingredient_measurement (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    to_grams NUMERIC(10, 2)  -- Conversion factor to grams
);

CREATE INDEX IF NOT EXISTS idx_ingredient_measurement_name ON recipe.ingredient_measurement(name);

-- Ingredients table (references common.department)
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

-- Recipe ingredients junction table
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
