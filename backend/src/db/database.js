const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
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
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('salon', 'admin')),
      full_name TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      name TEXT,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'free' CHECK(status IN ('free', 'occupied', 'reserved')),
      current_order_id INTEGER,
      position_x INTEGER DEFAULT 0,
      position_y INTEGER DEFAULT 0,
      zone TEXT NOT NULL DEFAULT 'salon' CHECK(zone IN ('salon', 'vereda')),
      layout_x REAL,
      layout_y REAL
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      color TEXT DEFAULT '#6366f1',
      kind TEXT NOT NULL DEFAULT 'comida' CHECK(kind IN ('comida', 'bebida'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      available INTEGER DEFAULT 1,
      stock_item_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
      quantity_per_unit REAL NOT NULL
  );
  
    -- Jornada de trabajo: empieza con la primera comanda y termina cuando el local la cierra
    -- (no coincide con el día del calendario: puede cerrar a las 00:50, 01:30, 02:00...)
    CREATE TABLE IF NOT EXISTS work_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_at TEXT DEFAULT (datetime('now','localtime')),
      closed_at TEXT,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      closed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER REFERENCES tables(id),
      user_id INTEGER REFERENCES users(id),
      table_number INTEGER,
      persons_count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'cancelled')),
      notes TEXT,
      total REAL DEFAULT 0,
      payment_method TEXT CHECK(payment_method IN ('efectivo', 'transferencia', 'tarjeta', 'mixto')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      closed_at TEXT,
      table_zone TEXT,
      work_day_id INTEGER REFERENCES work_days(id),
      order_type TEXT NOT NULL DEFAULT 'mesa' CHECK(order_type IN ('mesa', 'delivery', 'takeaway')),
      customer_name TEXT,
      customer_address TEXT,
      voided_at TEXT,
      voided_by TEXT,
      void_reason TEXT
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
      order_id INTEGER REFERENCES orders(id),
      type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjustment')),
      quantity REAL NOT NULL,
      notes TEXT,
      date TEXT DEFAULT (date('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migración: bases creadas antes de existir las zonas (salón/vereda) y la distribución libre.
  // layout_x/layout_y = posición en el plano (NULL = todavía sin ubicar, el frontend la acomoda sola).
  // position_x/position_y quedan como columnas heredadas y ya no se usan.
  const tableCols = db.prepare("PRAGMA table_info(tables)").all().map(c => c.name);
  if (!tableCols.includes('zone')) {
    db.exec("ALTER TABLE tables ADD COLUMN zone TEXT NOT NULL DEFAULT 'salon' CHECK(zone IN ('salon', 'vereda'))");
  }
  if (!tableCols.includes('layout_x')) db.exec('ALTER TABLE tables ADD COLUMN layout_x REAL');
  if (!tableCols.includes('layout_y')) db.exec('ALTER TABLE tables ADD COLUMN layout_y REAL');

  // Migración: cada comanda guarda en qué zona estaba su mesa (salón/vereda) al abrirse, para que
  // las estadísticas por zona se mantengan aunque la mesa cambie de zona o se elimine más adelante.
  // Las comandas anteriores toman la zona actual de su mesa (lo mejor que se puede saber).
  const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  if (!orderCols.includes('table_zone')) {
    db.exec('ALTER TABLE orders ADD COLUMN table_zone TEXT');
    db.exec('UPDATE orders SET table_zone = (SELECT zone FROM tables WHERE tables.id = orders.table_id) WHERE table_id IS NOT NULL');
  }

  // Jornadas: las comandas anteriores se agrupan por día del calendario (una jornada por fecha).
  // Solo queda abierta la última, y únicamente si es de hoy o tiene comandas en curso.
  if (!orderCols.includes('work_day_id')) {
    db.exec('ALTER TABLE orders ADD COLUMN work_day_id INTEGER REFERENCES work_days(id)');
    const days = db.prepare(`
      SELECT date(created_at) AS day, MIN(created_at) AS opened_at,
             MAX(COALESCE(closed_at, created_at)) AS last_at,
             SUM(status = 'open') AS open_orders
      FROM orders GROUP BY day ORDER BY day
    `).all();
    const today = db.prepare("SELECT date('now','localtime') AS d").get().d;
    const insertDay = db.prepare('INSERT INTO work_days (opened_at, closed_at, status) VALUES (?, ?, ?)');
    const setDay = db.prepare('UPDATE orders SET work_day_id = ? WHERE date(created_at) = ?');
    db.transaction(() => {
      days.forEach((d, i) => {
        const isLast = i === days.length - 1;
        const keepOpen = isLast && (d.day === today || d.open_orders > 0);
        const id = insertDay.run(d.opened_at, keepOpen ? null : d.last_at, keepOpen ? 'open' : 'closed').lastInsertRowid;
        setDay.run(id, d.day);
      });
    })();
  }

  // Tipo de categoría (comida / bebida) para separar platos de bebidas en las estadísticas.
  // En bases existentes se deduce del nombre; después se puede cambiar desde el Menú.
  const catCols = db.prepare("PRAGMA table_info(menu_categories)").all().map(c => c.name);
  if (!catCols.includes('kind')) {
    db.exec("ALTER TABLE menu_categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'comida' CHECK(kind IN ('comida', 'bebida'))");
    const words = ['bebida', 'gaseosa', 'cerveza', 'vino', 'cafe', 'café', 'jugo', 'agua', 'trago', 'coctel', 'cóctel',
      'licuado', 'infusion', 'infusión', 'whisky', 'licor', 'aperitivo', 'champagne', 'espumante', 'fernet'];
    const upd = db.prepare("UPDATE menu_categories SET kind = 'bebida' WHERE lower(name) LIKE ?");
    words.forEach(w => upd.run(`%${w}%`));
  }

  // Pedidos de Delivery / Take Away: no tienen mesa; guardan el nombre y (en delivery) la dirección.
  // Las comandas anteriores son todas de mesa (valor por defecto).
  const orderCols2 = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  if (!orderCols2.includes('order_type')) {
    db.exec("ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'mesa' CHECK(order_type IN ('mesa', 'delivery', 'takeaway'))");
    db.exec('ALTER TABLE orders ADD COLUMN customer_name TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN customer_address TEXT');
  }

  // Columnas agregadas con el descuento de stock y los usuarios: en bases que ya existían
  // hay que sumarlas (CREATE TABLE IF NOT EXISTS no modifica tablas viejas).
  const hasCol = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
  if (!hasCol('orders', 'user_id')) db.exec('ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id)');
  if (!hasCol('stock_movements', 'order_id')) db.exec('ALTER TABLE stock_movements ADD COLUMN order_id INTEGER REFERENCES orders(id)');

  // Anulación de pedidos ya cobrados: queda registrado cuándo, quién y por qué
  if (!hasCol('orders', 'voided_at')) {
    db.exec('ALTER TABLE orders ADD COLUMN voided_at TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN voided_by TEXT');
    db.exec('ALTER TABLE orders ADD COLUMN void_reason TEXT');
  }

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
    const setKind = db.prepare("UPDATE menu_categories SET kind = 'bebida' WHERE id = ?");
    const insertItem = db.prepare('INSERT INTO menu_items (category_id, name, price, available) VALUES (?, ?, ?, 1)');

    const entradas = insertCat.run('Entradas', 0, '#f59e0b').lastInsertRowid;
    const principales = insertCat.run('Platos Principales', 1, '#ef4444').lastInsertRowid;
    const bebidas = insertCat.run('Bebidas', 2, '#3b82f6').lastInsertRowid;
    const postres = insertCat.run('Postres', 3, '#8b5cf6').lastInsertRowid;
    setKind.run(bebidas);

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

  // Seed default admin user — CAMBIAR esta contraseña apenas se pruebe por primera vez
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)')
      .run('admin', hash, 'admin', 'Administrador');
  }
}

initializeDatabase();

module.exports = db;