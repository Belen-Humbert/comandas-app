const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const tables = db.prepare(`
    SELECT t.*, o.id as order_id, o.persons_count, o.created_at as order_created_at,
           COUNT(oi.id) as item_count
    FROM tables t
    LEFT JOIN orders o ON o.id = t.current_order_id AND o.status = 'open'
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY t.id
    ORDER BY t.number
  `).all();
  res.json(tables);
});

router.get('/:id', (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  if (!table) return res.status(404).json({ error: 'Mesa no encontrada' });
  res.json(table);
});

router.post('/', (req, res) => {
  const { number, name, capacity, position_x, position_y } = req.body;
  if (!number) return res.status(400).json({ error: 'Número de mesa requerido' });
  try {
    const result = db.prepare(
      'INSERT INTO tables (number, name, capacity, position_x, position_y) VALUES (?, ?, ?, ?, ?)'
    ).run(number, name || `Mesa ${number}`, capacity || 4, position_x || 0, position_y || 0);
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Número de mesa ya existe' });
  }
});

router.put('/:id', (req, res) => {
  const { name, capacity, status, position_x, position_y } = req.body;
  db.prepare('UPDATE tables SET name=?, capacity=?, position_x=?, position_y=? WHERE id=?')
    .run(name, capacity, position_x, position_y, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  if (!table) return res.status(404).json({ error: 'Mesa no encontrada' });
  if (table.status === 'occupied') return res.status(400).json({ error: 'No se puede eliminar una mesa ocupada' });
  db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
