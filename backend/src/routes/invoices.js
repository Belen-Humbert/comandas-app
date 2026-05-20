const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const { date } = req.query;
  let query = 'SELECT i.*, o.table_number FROM invoices i JOIN orders o ON o.id = i.order_id';
  const params = [];
  if (date) { query += " WHERE date(i.date) = ?"; params.push(date); }
  query += ' ORDER BY i.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, o.table_number, o.persons_count, o.payment_method
    FROM invoices i JOIN orders o ON o.id = i.order_id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

  const items = db.prepare(`
    SELECT oi.* FROM order_items oi WHERE oi.order_id = ?
  `).all(invoice.order_id);

  res.json({ ...invoice, items });
});

router.post('/', (req, res) => {
  const { order_id, customer_name, customer_tax_id } = req.body;
  if (!order_id) return res.status(400).json({ error: 'order_id requerido' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada' });

  // Check if invoice already exists
  const existing = db.prepare('SELECT id FROM invoices WHERE order_id = ?').get(order_id);
  if (existing) return res.json({ id: existing.id, existing: true });

  // Generate invoice number
  const year = new Date().getFullYear();
  const lastInvoice = db.prepare("SELECT number FROM invoices WHERE number LIKE ? ORDER BY id DESC LIMIT 1").get(`${year}-%`);
  let nextNum = 1;
  if (lastInvoice) {
    const parts = lastInvoice.number.split('-');
    nextNum = parseInt(parts[parts.length - 1]) + 1;
  }
  const invoiceNumber = `${year}-${String(nextNum).padStart(6, '0')}`;

  const result = db.prepare(`
    INSERT INTO invoices (order_id, number, customer_name, customer_tax_id, subtotal, tax, total)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(order_id, invoiceNumber, customer_name || null, customer_tax_id || null, order.total, order.total);

  res.json({ id: result.lastInsertRowid, number: invoiceNumber });
});

module.exports = router;
