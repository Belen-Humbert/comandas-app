const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { ensureWorkDay } = require('./workdays');

const ORDER_TYPES = ['mesa', 'delivery', 'takeaway'];
const TYPE_LABEL = { delivery: 'Delivery', takeaway: 'Take Away' };

// Cómo se nombra una comanda en la caja, el stock, etc.: "Mesa 5", "Delivery #12", "Take Away #13"
const orderLabel = (order) =>
  order.order_type && order.order_type !== 'mesa' ? `${TYPE_LABEL[order.order_type]} #${order.id}` : `Mesa ${order.table_number}`;

// Get all open orders
router.get('/', (req, res) => {
  const { status, date, table_id, work_day_id, limit, type } = req.query;
  let query = `
    SELECT o.*, t.number as table_number_ref, t.name as table_name_ref,
           COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
  `;
  const params = [];
  const where = [];
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (date) { where.push("date(o.created_at) = ?"); params.push(date); }
  if (type) {
    const types = String(type).split(',');
    if (!types.every(t => ORDER_TYPES.includes(t))) return res.status(400).json({ error: 'Tipo de comanda inválido' });
    where.push(`o.order_type IN (${types.map(() => '?').join(',')})`);
    params.push(...types);
  }
  if (work_day_id) {
    const wid = Number(work_day_id);
    if (!Number.isInteger(wid)) return res.status(400).json({ error: 'Jornada inválida' });
    where.push('o.work_day_id = ?');
    params.push(wid);
  }
  if (table_id) {
    const id = Number(table_id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Mesa inválida' });
    where.push('o.table_id = ?');
    params.push(id);
  }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC';

  // Límite opcional (para el historial de una mesa); sin límite se devuelve todo como antes
  if (limit !== undefined) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'Límite inválido' });
    query += ' LIMIT ?';
    params.push(Math.min(n, 500));
  }
  res.json(db.prepare(query).all(...params));
});

// Get single order with items
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada' });
  const items = db.prepare(`
    SELECT oi.*, mi.name as menu_name
    FROM order_items oi
    LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `).all(req.params.id);
  res.json({ ...order, items });
});

// Open new order
router.post('/', (req, res) => {
  const { table_id, persons_count, notes } = req.body;
  if (!table_id) return res.status(400).json({ error: 'Mesa requerida' });

  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(table_id);
  if (!table) return res.status(404).json({ error: 'Mesa no encontrada' });
  if (table.status === 'occupied') return res.status(400).json({ error: 'Mesa ya está ocupada' });

  const openOrder = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'open'").get(table_id);
  if (openOrder) return res.status(400).json({ error: 'La mesa ya tiene una comanda abierta', order_id: openOrder.id });

  // La comanda queda anotada en la jornada abierta (si todavía no hay, esta comanda la abre)
  const workDay = ensureWorkDay();
  const result = db.prepare(
    'INSERT INTO orders (table_id, table_number, persons_count, notes, table_zone, work_day_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(table_id, table.number, persons_count || 1, notes, table.zone, workDay.id);

  db.prepare("UPDATE tables SET status = 'occupied', current_order_id = ? WHERE id = ?")
    .run(result.lastInsertRowid, table_id);

  res.json({ id: result.lastInsertRowid });
});

// Nuevo pedido de Delivery / Take Away (sin mesa). Queda abierto con sus productos; después se cobra
// con POST /:id/close, igual que una mesa (así caja y descuento de stock funcionan igual).
// Los precios se toman del menú, no del pedido del cliente.
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
router.post('/delivery', (req, res) => {
  const { order_type, items } = req.body;
  if (!['delivery', 'takeaway'].includes(order_type)) return res.status(400).json({ error: 'Tipo de pedido inválido' });
  const name = clean(req.body.customer_name, 100);
  const address = clean(req.body.customer_address, 200);
  const notes = clean(req.body.notes, 500);
  if (!name) return res.status(400).json({ error: 'El nombre de quien hace el pedido es obligatorio' });
  if (order_type === 'delivery' && !address) return res.status(400).json({ error: 'La dirección de entrega es obligatoria' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'El pedido no tiene productos' });
  if (items.length > 100) return res.status(400).json({ error: 'Demasiados productos en el pedido' });

  const lines = [];
  for (const it of items) {
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return res.status(400).json({ error: 'Cantidad inválida' });
    const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ? AND available = 1').get(it.menu_item_id);
    if (!menuItem) return res.status(400).json({ error: 'Hay un producto que ya no está disponible en el menú' });
    lines.push({ menuItem, qty });
  }

  const create = db.transaction(() => {
    const workDay = ensureWorkDay();
    // persons_count 0: no son comensales de salón y no deben contar en "personas atendidas"
    const id = db.prepare(`
      INSERT INTO orders (table_id, table_number, persons_count, notes, table_zone, work_day_id, order_type, customer_name, customer_address)
      VALUES (NULL, NULL, 0, ?, ?, ?, ?, ?, ?)
    `).run(notes || null, order_type, workDay.id, order_type, name, order_type === 'delivery' ? address : null).lastInsertRowid;
    const ins = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)');
    for (const { menuItem, qty } of lines) ins.run(id, menuItem.id, menuItem.name, qty, menuItem.price);
    updateOrderTotal(id);
    return id;
  });
  res.json({ id: create() });
});

// Add items to order
router.post('/:id/items', (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND status = 'open'").get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada o cerrada' });

  const items = Array.isArray(req.body) ? req.body : [req.body];
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, notes, person_number) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertItem.run(req.params.id, item.menu_item_id, item.name, item.quantity || 1, item.unit_price, item.notes || null, item.person_number || 0);
    }
    updateOrderTotal(req.params.id);
  });
  insertMany(items);

  res.json({ ok: true });
});

// Update order item
router.put('/:id/items/:itemId', (req, res) => {
  const { quantity, notes, person_number } = req.body;
  if (quantity <= 0) {
    db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(req.params.itemId, req.params.id);
  } else {
    db.prepare('UPDATE order_items SET quantity=?, notes=?, person_number=? WHERE id=? AND order_id=?')
      .run(quantity, notes, person_number, req.params.itemId, req.params.id);
  }
  updateOrderTotal(req.params.id);
  res.json({ ok: true });
});

// Delete order item
router.delete('/:id/items/:itemId', (req, res) => {
  db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(req.params.itemId, req.params.id);
  updateOrderTotal(req.params.id);
  res.json({ ok: true });
});

// Close order (pay)
router.post('/:id/close', (req, res) => {
  const { payment_method, notes, mixed_payments } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND status = 'open'").get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada o ya cerrada' });

  const closeOrder = db.transaction(() => {
    db.prepare("UPDATE orders SET status='closed', closed_at=datetime('now','localtime'), payment_method=?, notes=? WHERE id=?")
      .run(payment_method, notes, req.params.id);
    db.prepare("UPDATE tables SET status='free', current_order_id=NULL WHERE id=?")
      .run(order.table_id);

    // Descontar stock según la receta de cada ítem vendido
    const soldItems = db.prepare('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?').all(req.params.id);
    for (const sold of soldItems) {
      if (!sold.menu_item_id) continue; // ítem cargado a mano, sin producto de menú vinculado
      const ingredients = db.prepare('SELECT * FROM recipe_ingredients WHERE menu_item_id = ?').all(sold.menu_item_id);
      for (const ing of ingredients) {
        const consumed = ing.quantity_per_unit * sold.quantity;
        const stockItem = db.prepare('SELECT current_quantity FROM stock_items WHERE id = ?').get(ing.stock_item_id);
        if (!stockItem) continue;
        const newQty = Math.max(0, stockItem.current_quantity - consumed);
        db.prepare('UPDATE stock_items SET current_quantity = ? WHERE id = ?').run(newQty, ing.stock_item_id);
        db.prepare("INSERT INTO stock_movements (stock_item_id, order_id, type, quantity, notes) VALUES (?, ?, 'out', ?, ?)")
          .run(ing.stock_item_id, req.params.id, consumed, `Venta automática - Comanda #${req.params.id}`);
      }
    }

    // Register cash movement for efectivo payments
    if (payment_method === 'efectivo' || payment_method === 'mixto') {
      const openRegister = db.prepare("SELECT id FROM cash_registers WHERE status='open' ORDER BY id DESC LIMIT 1").get();
      if (openRegister) {
        const amount = payment_method === 'efectivo' ? order.total :
          (mixed_payments?.efectivo || 0);
        if (amount > 0) {
          db.prepare('INSERT INTO cash_movements (register_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)')
            .run(openRegister.id, 'in', amount, `Cobro ${orderLabel(order)}`, order.id);
        }
      }
    }
  });
  closeOrder();
  res.json({ ok: true, order_id: req.params.id });
});

// Cancel order
router.post('/:id/cancel', (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND status = 'open'").get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada' });
  db.prepare("UPDATE orders SET status='cancelled', closed_at=datetime('now','localtime') WHERE id=?").run(req.params.id);
  db.prepare("UPDATE tables SET status='free', current_order_id=NULL WHERE id=?").run(order.table_id);
  res.json({ ok: true });
});

// Mark items as printed
router.post('/:id/print', (req, res) => {
  db.prepare('UPDATE order_items SET printed=1 WHERE order_id=?').run(req.params.id);
  res.json({ ok: true });
});

function updateOrderTotal(orderId) {
  const total = db.prepare('SELECT SUM(quantity * unit_price) as total FROM order_items WHERE order_id = ?').get(orderId);
  db.prepare('UPDATE orders SET total = ? WHERE id = ?').run(total.total || 0, orderId);
}

module.exports = router;