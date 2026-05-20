const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Categories
router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM menu_categories ORDER BY order_index, name').all();
  res.json(cats);
});

router.post('/categories', (req, res) => {
  const { name, order_index, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const result = db.prepare('INSERT INTO menu_categories (name, order_index, color) VALUES (?, ?, ?)').run(name, order_index || 0, color || '#6366f1');
  res.json({ id: result.lastInsertRowid });
});

router.put('/categories/:id', (req, res) => {
  const { name, order_index, color } = req.body;
  db.prepare('UPDATE menu_categories SET name=?, order_index=?, color=? WHERE id=?').run(name, order_index, color, req.params.id);
  res.json({ ok: true });
});

router.delete('/categories/:id', (req, res) => {
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

router.post('/items', (req, res) => {
  const { category_id, name, description, price, available } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Nombre y precio requeridos' });
  const result = db.prepare(
    'INSERT INTO menu_items (category_id, name, description, price, available) VALUES (?, ?, ?, ?, ?)'
  ).run(category_id, name, description, price, available !== false ? 1 : 0);
  res.json({ id: result.lastInsertRowid });
});

router.put('/items/:id', (req, res) => {
  const { category_id, name, description, price, available } = req.body;
  db.prepare('UPDATE menu_items SET category_id=?, name=?, description=?, price=?, available=? WHERE id=?')
    .run(category_id, name, description, price, available ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/items/:id', (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
