const express = require('express');
const router = express.Router();
const db = require('../db/database');

// === ARQUEO DE CAJA ===
router.get('/registers', (req, res) => {
  const registers = db.prepare('SELECT * FROM cash_registers ORDER BY id DESC LIMIT 30').all();
  res.json(registers);
});

router.get('/registers/current', (req, res) => {
  const register = db.prepare("SELECT * FROM cash_registers WHERE status='open' ORDER BY id DESC LIMIT 1").get();
  if (!register) return res.json(null);

  const movements = db.prepare('SELECT * FROM cash_movements WHERE register_id=? ORDER BY created_at DESC').all(register.id);
  const sales = db.prepare(`
    SELECT SUM(o.total) as total, COUNT(*) as count, o.payment_method
    FROM orders o
    WHERE o.status='closed' AND datetime(o.closed_at) >= datetime(?)
    GROUP BY o.payment_method
  `).all(register.opened_at);

  res.json({ ...register, movements, sales });
});

router.post('/registers/open', (req, res) => {
  const existing = db.prepare("SELECT id FROM cash_registers WHERE status='open'").get();
  if (existing) return res.status(400).json({ error: 'Ya hay una caja abierta' });

  const { initial_amount, notes } = req.body;
  const result = db.prepare('INSERT INTO cash_registers (initial_amount, notes) VALUES (?, ?)').run(initial_amount || 0, notes);
  res.json({ id: result.lastInsertRowid });
});

router.post('/registers/:id/close', (req, res) => {
  const { final_amount, notes } = req.body;
  const register = db.prepare('SELECT * FROM cash_registers WHERE id=?').get(req.params.id);
  if (!register) return res.status(404).json({ error: 'Caja no encontrada' });

  // Calculate expected: initial + cash sales
  const cashIn = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_movements WHERE register_id=? AND type='in'").get(req.params.id);
  const cashOut = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_movements WHERE register_id=? AND type='out'").get(req.params.id);
  const expected = register.initial_amount + cashIn.total - cashOut.total;
  const difference = (final_amount || 0) - expected;

  db.prepare(`UPDATE cash_registers SET status='closed', closed_at=datetime('now','localtime'), final_amount=?, expected_amount=?, difference=?, notes=? WHERE id=?`)
    .run(final_amount, expected, difference, notes, req.params.id);

  res.json({ ok: true, expected, difference });
});

router.post('/registers/:id/movements', (req, res) => {
  const { type, amount, description } = req.body;
  if (!type || !amount || !description) return res.status(400).json({ error: 'Tipo, monto y descripción requeridos' });
  const result = db.prepare('INSERT INTO cash_movements (register_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(req.params.id, type, amount, description);
  res.json({ id: result.lastInsertRowid });
});

// === CAJA CHICA ===
router.get('/petty', (req, res) => {
  const { from, to } = req.query;
  let query = 'SELECT * FROM petty_cash';
  const params = [];
  const where = [];
  if (from) { where.push("date(date) >= ?"); params.push(from); }
  if (to) { where.push("date(date) <= ?"); params.push(to); }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY date DESC, id DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/petty', (req, res) => {
  const { date, type, amount, description, comments } = req.body;
  if (!type || !amount || !description) return res.status(400).json({ error: 'Tipo, monto y descripción requeridos' });
  const result = db.prepare('INSERT INTO petty_cash (date, type, amount, description, comments) VALUES (?, ?, ?, ?, ?)')
    .run(date || new Date().toISOString().split('T')[0], type, amount, description, comments);
  res.json({ id: result.lastInsertRowid });
});

router.put('/petty/:id', (req, res) => {
  const { date, type, amount, description, comments } = req.body;
  db.prepare('UPDATE petty_cash SET date=?, type=?, amount=?, description=?, comments=? WHERE id=?')
    .run(date, type, amount, description, comments, req.params.id);
  res.json({ ok: true });
});

router.delete('/petty/:id', (req, res) => {
  db.prepare('DELETE FROM petty_cash WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
