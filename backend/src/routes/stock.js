const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM stock_categories ORDER BY name').all());
});

router.get('/items', (req, res) => {
  const items = db.prepare(`
    SELECT si.*, sc.name as category_name
    FROM stock_items si
    LEFT JOIN stock_categories sc ON sc.id = si.category_id
    WHERE si.active = 1
    ORDER BY sc.name, si.name
  `).all();
  res.json(items);
});

router.get('/items/low', (req, res) => {
  const items = db.prepare(`
    SELECT si.*, sc.name as category_name
    FROM stock_items si
    LEFT JOIN stock_categories sc ON sc.id = si.category_id
    WHERE si.active = 1 AND si.current_quantity <= si.min_quantity
    ORDER BY si.current_quantity ASC
  `).all();
  res.json(items);
});

router.post('/items', (req, res) => {
  const { name, unit, current_quantity, min_quantity, cost_per_unit, category_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const result = db.prepare('INSERT INTO stock_items (name, unit, current_quantity, min_quantity, cost_per_unit, category_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, unit || 'unidad', current_quantity || 0, min_quantity || 0, cost_per_unit || 0, category_id);
  res.json({ id: result.lastInsertRowid });
});

router.put('/items/:id', (req, res) => {
  const { name, unit, min_quantity, cost_per_unit, category_id, active } = req.body;
  db.prepare('UPDATE stock_items SET name=?, unit=?, min_quantity=?, cost_per_unit=?, category_id=?, active=? WHERE id=?')
    .run(name, unit, min_quantity, cost_per_unit, category_id, active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/items/:id', (req, res) => {
  db.prepare('UPDATE stock_items SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Movements
router.get('/items/:id/movements', (req, res) => {
  const movements = db.prepare('SELECT * FROM stock_movements WHERE stock_item_id=? ORDER BY date DESC, id DESC LIMIT 50').all(req.params.id);
  res.json(movements);
});

router.post('/items/:id/movements', (req, res) => {
  const { type, quantity, notes, date } = req.body;
  if (!type || !quantity) return res.status(400).json({ error: 'Tipo y cantidad requeridos' });

  const item = db.prepare('SELECT * FROM stock_items WHERE id=?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item no encontrado' });

  const addMovement = db.transaction(() => {
    db.prepare('INSERT INTO stock_movements (stock_item_id, type, quantity, notes, date) VALUES (?, ?, ?, ?, ?)').run(req.params.id, type, quantity, notes, date || new Date().toISOString().split('T')[0]);

    let newQty = item.current_quantity;
    if (type === 'in') newQty += quantity;
    else if (type === 'out') newQty = Math.max(0, newQty - quantity);
    else if (type === 'adjustment') newQty = quantity;

    db.prepare('UPDATE stock_items SET current_quantity=? WHERE id=?').run(newQty, req.params.id);
  });
  addMovement();
  res.json({ ok: true });
});

module.exports = router;
