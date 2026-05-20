const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/comandas.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      name TEXT,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'free' CHECK(status IN ('free', 'occupied', 'reserved')),
      current_order_id INTEGER,
      position_x INTEGER DEFAULT 0,
      position_y INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      color TEXT DEFAULT '#6366f1'
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      available INTEGER DEFAULT 1,
      stock_item_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER REFERENCES tables(id),
      table_number INTEGER,
      persons_count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'cancelled')),
      notes TEXT,
      total REAL DEFAULT 0,
      payment_method TEXT CHECK(payment_method IN ('efectivo', 'transferencia', 'tarjeta', 'mixto', NULL)),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER REFERENCES menu_items(id),
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      notes TEXT,
      person_number INTEGER DEFAULT 0,
      printed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      number TEXT NOT NULL UNIQUE,
      date TEXT DEFAULT (date('now','localtime')),
      customer_name TEXT,
      customer_tax_id TEXT,
      subtotal REAL,
      tax REAL DEFAULT 0,
      total REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER REFERENCES tables(id),
      customer_name TEXT NOT NULL,
      phone TEXT,
      persons_count INTEGER DEFAULT 1,
      datetime TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'arrived', 'cancelled')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS cash_registers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_at TEXT DEFAULT (datetime('now','localtime')),
      closed_at TEXT,
      initial_amount REAL DEFAULT 0,
      final_amount REAL,
      expected_amount REAL,
      difference REAL,
      notes TEXT,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed'))
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      register_id INTEGER REFERENCES cash_registers(id),
      type TEXT NOT NULL CHECK(type IN ('in', 'out')),
      amount REAL NOT NULL,
      description TEXT,
      order_id INTEGER REFERENCES orders(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS petty_cash (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT DEFAULT (date('now','localtime')),
      type TEXT NOT NULL CHECK(type IN ('in', 'out')),
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      comments TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      amount REAL NOT NULL,
      date TEXT DEFAULT (date('now','localtime')),
      description TEXT,
      payment_method TEXT CHECK(payment_method IN ('efectivo', 'transferencia', 'cheque', 'otro')),
      status TEXT DEFAULT 'paid' CHECK(status IN ('pending', 'paid')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS stock_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT DEFAULT 'unidad',
      current_quantity REAL DEFAULT 0,
      min_quantity REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      category_id INTEGER REFERENCES stock_categories(id),
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
      type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjustment')),
      quantity REAL NOT NULL,
      notes TEXT,
      date TEXT DEFAULT (date('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Seed default tables if none exist
  const tableCount = db.prepare('SELECT COUNT(*) as count FROM tables').get();
  if (tableCount.count === 0) {
    const insertTable = db.prepare('INSERT INTO tables (number, name, capacity, position_x, position_y) VALUES (?, ?, ?, ?, ?)');
    const tables = [
      [1, 'Mesa 1', 4, 0, 0], [2, 'Mesa 2', 4, 1, 0], [3, 'Mesa 3', 4, 2, 0], [4, 'Mesa 4', 4, 3, 0],
      [5, 'Mesa 5', 4, 0, 1], [6, 'Mesa 6', 4, 1, 1], [7, 'Mesa 7', 4, 2, 1], [8, 'Mesa 8', 4, 3, 1],
      [9, 'Mesa 9', 4, 0, 2], [10, 'Mesa 10', 4, 1, 2], [11, 'Mesa 11', 4, 2, 2], [12, 'Mesa 12', 4, 3, 2],
      [13, 'Mesa 13', 4, 0, 3], [14, 'Mesa 14', 4, 1, 3], [15, 'Mesa 15', 4, 2, 3],
    ];
    tables.forEach(t => insertTable.run(...t));
  }

  // Seed default menu if none exists
  const catCount = db.prepare('SELECT COUNT(*) as count FROM menu_categories').get();
  if (catCount.count === 0) {
    const insertCat = db.prepare('INSERT INTO menu_categories (name, order_index, color) VALUES (?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO menu_items (category_id, name, price, available) VALUES (?, ?, ?, 1)');

    const entradas = insertCat.run('Entradas', 0, '#f59e0b').lastInsertRowid;
    const principales = insertCat.run('Platos Principales', 1, '#ef4444').lastInsertRowid;
    const bebidas = insertCat.run('Bebidas', 2, '#3b82f6').lastInsertRowid;
    const postres = insertCat.run('Postres', 3, '#8b5cf6').lastInsertRowid;

    [['Empanadas (x6)', 1500], ['Tabla de fiambres', 2800], ['Provoleta', 1800], ['Croquetas', 1200]].forEach(([n, p]) => insertItem.run(entradas, n, p));
    [['Milanesa napolitana', 3500], ['Bife de lomo', 5200], ['Pollo al horno', 3200], ['Pasta del día', 2800], ['Ravioles', 2600], ['Tallarines', 2400]].forEach(([n, p]) => insertItem.run(principales, n, p));
    [['Coca Cola', 800], ['Agua mineral', 600], ['Cerveza', 1200], ['Vino copa', 1500], ['Jugo naranja', 700], ['Agua soda', 600]].forEach(([n, p]) => insertItem.run(bebidas, n, p));
    [['Flan con crema', 900], ['Helado', 1100], ['Torta del día', 1300], ['Panqueques', 1000]].forEach(([n, p]) => insertItem.run(postres, n, p));
  }

  // Seed default stock categories
  const stockCatCount = db.prepare('SELECT COUNT(*) as count FROM stock_categories').get();
  if (stockCatCount.count === 0) {
    const insertStockCat = db.prepare('INSERT INTO stock_categories (name) VALUES (?)');
    ['Carnes', 'Verduras', 'Lácteos', 'Bebidas', 'Almacén', 'Limpieza'].forEach(n => insertStockCat.run(n));
  }
}

initializeDatabase();

module.exports = db;
