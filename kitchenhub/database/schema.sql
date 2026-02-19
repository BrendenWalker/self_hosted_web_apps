-- PostgreSQL Schema for Shopping List System
-- Migrated from Firebird
-- Requires common schema: run common-schema.sql first (provides common.department)

-- Store table
CREATE TABLE IF NOT EXISTS store (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store zones (layout information)
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

-- Items table
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    department INTEGER REFERENCES common.department(id),
    qty REAL DEFAULT 0,
    changed INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_department ON items(department);
CREATE INDEX IF NOT EXISTS idx_items_changed ON items(changed);

-- Shopping list table
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
