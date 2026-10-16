const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');

// Categories
router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM menu_categories ORDER BY order_index, name').all();
  res.json(cats);
});

const KINDS = ['comida', 'bebida'];

router.post('/categories',requireRole('admin'), (req, res) => {
  const { name, order_index, color, kind } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  if (kind !== undefined && !KINDS.includes(kind)) return res.status(400).json({ error: 'Tipo inválido (comida o bebida)' });
  const result = db.prepare('INSERT INTO menu_categories (name, order_index, color, kind) VALUES (?, ?, ?, ?)').run(name, order_index || 0, color || '#6366f1', kind || 'comida');
  res.json({ id: result.lastInsertRowid });
});

router.put('/categories/:id',requireRole('admin'), (req, res) => {
  const { name, order_index, color, kind } = req.body;
  if (kind !== undefined && !KINDS.includes(kind)) return res.status(400).json({ error: 'Tipo inválido (comida o bebida)' });
  // order_index y kind se conservan si no vienen en el pedido
  db.prepare('UPDATE menu_categories SET name=?, order_index=COALESCE(?, order_index), color=?, kind=COALESCE(?, kind) WHERE id=?')
    .run(name, order_index ?? null, color, kind ?? null, req.params.id);
  res.json({ ok: true });
});

router.delete('/categories/:id', requireRole('admin'),(req, res) => {
  db.prepare('DELETE FROM menu_categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Items
router.get('/items', (req, res) => {
  const items = db.prepare(`
    SELECT mi.*, mc.name as category_name, mc.color as category_color
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mc.id = mi.category_id
    ORDER BY mc.order_index, mi.name
  `).all();
  res.json(items);
});

router.get('/items/search', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const items = db.prepare(`
    SELECT mi.*, mc.name as category_name, mc.color as category_color
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mc.id = mi.category_id
    WHERE mi.name LIKE ? AND mi.available = 1
    ORDER BY mc.order_index, mi.name
  `).all(q);
  res.json(items);
});

router.post('/items', requireRole('admin'),(req, res) => {
  const { category_id, name, description, price, available } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Nombre y precio requeridos' });
  const result = db.prepare(
    'INSERT INTO menu_items (category_id, name, description, price, available) VALUES (?, ?, ?, ?, ?)'
  ).run(category_id, name, description, price, available !== false ? 1 : 0);
  res.json({ id: result.lastInsertRowid });
});

router.put('/items/:id', requireRole('admin'), (req, res) => {
  const { category_id, name, description, price, available } = req.body;
  db.prepare('UPDATE menu_items SET category_id=?, name=?, description=?, price=?, available=? WHERE id=?')
    .run(category_id, name, description, price, available ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/items/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
