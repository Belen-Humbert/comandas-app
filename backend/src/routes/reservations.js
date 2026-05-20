const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const { date, status } = req.query;
  let query = `
    SELECT r.*, t.name as table_name, t.number as table_number
    FROM reservations r
    LEFT JOIN tables t ON t.id = r.table_id
  `;
  const params = [];
  const where = [];
  if (date) { where.push("date(r.datetime) = ?"); params.push(date); }
  if (status) { where.push("r.status = ?"); params.push(status); }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY r.datetime ASC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const { table_id, customer_name, phone, persons_count, datetime, notes } = req.body;
  if (!customer_name || !datetime) return res.status(400).json({ error: 'Nombre y fecha/hora requeridos' });
  const result = db.prepare(
    'INSERT INTO reservations (table_id, customer_name, phone, persons_count, datetime, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(table_id || null, customer_name, phone, persons_count || 1, datetime, notes);
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { table_id, customer_name, phone, persons_count, datetime, notes, status } = req.body;
  db.prepare('UPDATE reservations SET table_id=?, customer_name=?, phone=?, persons_count=?, datetime=?, notes=?, status=? WHERE id=?')
    .run(table_id, customer_name, phone, persons_count, datetime, notes, status, req.params.id);

  if (status === 'arrived' && table_id) {
    db.prepare("UPDATE tables SET status='reserved' WHERE id=?").run(table_id);
  }
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM reservations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
