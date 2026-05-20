const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE active=1 ORDER BY name').all();
  res.json(suppliers);
});

router.post('/', (req, res) => {
  const { name, contact, phone, email, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const result = db.prepare('INSERT INTO suppliers (name, contact, phone, email, notes) VALUES (?, ?, ?, ?, ?)').run(name, contact, phone, email, notes);
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { name, contact, phone, email, notes, active } = req.body;
  db.prepare('UPDATE suppliers SET name=?, contact=?, phone=?, email=?, notes=?, active=? WHERE id=?').run(name, contact, phone, email, notes, active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE suppliers SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Payments
router.get('/:id/payments', (req, res) => {
  const payments = db.prepare('SELECT * FROM supplier_payments WHERE supplier_id=? ORDER BY date DESC').all(req.params.id);
  res.json(payments);
});

router.get('/payments/all', (req, res) => {
  const { from, to, status } = req.query;
  let query = `
    SELECT sp.*, s.name as supplier_name
    FROM supplier_payments sp
    JOIN suppliers s ON s.id = sp.supplier_id
  `;
  const params = [];
  const where = [];
  if (from) { where.push("date(sp.date) >= ?"); params.push(from); }
  if (to) { where.push("date(sp.date) <= ?"); params.push(to); }
  if (status) { where.push("sp.status = ?"); params.push(status); }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY sp.date DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/:id/payments', (req, res) => {
  const { amount, date, description, payment_method, status, notes } = req.body;
  if (!amount) return res.status(400).json({ error: 'Monto requerido' });
  const result = db.prepare('INSERT INTO supplier_payments (supplier_id, amount, date, description, payment_method, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.params.id, amount, date || new Date().toISOString().split('T')[0], description, payment_method, status || 'paid', notes);
  res.json({ id: result.lastInsertRowid });
});

router.put('/payments/:id', (req, res) => {
  const { amount, date, description, payment_method, status, notes } = req.body;
  db.prepare('UPDATE supplier_payments SET amount=?, date=?, description=?, payment_method=?, status=?, notes=? WHERE id=?')
    .run(amount, date, description, payment_method, status, notes, req.params.id);
  res.json({ ok: true });
});

router.delete('/payments/:id', (req, res) => {
  db.prepare('DELETE FROM supplier_payments WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
