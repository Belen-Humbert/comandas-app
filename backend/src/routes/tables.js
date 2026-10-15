const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');

const ZONES = ['salon', 'vereda'];
const MAX_COORD = 4000; // tope de seguridad; el plano del frontend es bastante más chico

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
  const { number, name, capacity, position_x, position_y, zone } = req.body;
  if (!number) return res.status(400).json({ error: 'Número de mesa requerido' });
  if (zone !== undefined && !ZONES.includes(zone)) return res.status(400).json({ error: 'Zona inválida' });
  try {
    // La mesa nueva queda sin ubicar (layout NULL): el frontend la acomoda en un lugar libre
    const result = db.prepare(
      'INSERT INTO tables (number, name, capacity, position_x, position_y, zone) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(number, name || `Mesa ${number}`, capacity || 4, position_x || 0, position_y || 0, zone || 'salon');
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Número de mesa ya existe' });
  }
});

// Guarda la distribución del plano: zona y posición de varias mesas de una vez (solo admin).
// Va antes de '/:id' para que 'layout' no se interprete como un id.
router.put('/layout', requireRole('admin'), (req, res) => {
  const list = req.body && req.body.tables;
  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: 'Se esperaba una lista de mesas' });
  }

  for (const t of list) {
    if (!Number.isInteger(t.id)) return res.status(400).json({ error: 'Mesa inválida en la lista' });
    if (!ZONES.includes(t.zone)) return res.status(400).json({ error: 'Zona inválida' });
    if (!Number.isFinite(t.layout_x) || !Number.isFinite(t.layout_y)) {
      return res.status(400).json({ error: 'Posición inválida' });
    }
  }

  const clamp = (n) => Math.min(MAX_COORD, Math.max(0, Math.round(n)));
  const update = db.prepare('UPDATE tables SET zone=?, layout_x=?, layout_y=? WHERE id=?');
  const saveAll = db.transaction(() => {
    let updated = 0;
    for (const t of list) {
      updated += update.run(t.zone, clamp(t.layout_x), clamp(t.layout_y), t.id).changes;
    }
    return updated;
  });
  res.json({ ok: true, updated: saveAll() });
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
