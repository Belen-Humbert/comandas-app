const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Get all open orders
router.get('/', (req, res) => {
  const { status, date } = req.query;
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
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' GROUP BY o.id ORDER BY o.created_at DESC';
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

  const result = db.prepare(
    'INSERT INTO orders (table_id, table_number, persons_count, notes) VALUES (?, ?, ?, ?)'
  ).run(table_id, table.number, persons_count || 1, notes);

  db.prepare("UPDATE tables SET status = 'occupied', current_order_id = ? WHERE id = ?")
    .run(result.lastInsertRowid, table_id);

  res.json({ id: result.lastInsertRowid });
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

    // Register cash movement for efectivo payments
    if (payment_method === 'efectivo' || payment_method === 'mixto') {
      const openRegister = db.prepare("SELECT id FROM cash_registers WHERE status='open' ORDER BY id DESC LIMIT 1").get();
      if (openRegister) {
        const amount = payment_method === 'efectivo' ? order.total :
          (mixed_payments?.efectivo || 0);
        if (amount > 0) {
          db.prepare('INSERT INTO cash_movements (register_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)')
            .run(openRegister.id, 'in', amount, `Cobro Mesa ${order.table_number}`, order.id);
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
