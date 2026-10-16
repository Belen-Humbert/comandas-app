const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Ver la receta completa de un plato/bebida del menú
router.get('/:menuItemId', (req, res) => {
  const ingredients = db.prepare(`
    SELECT ri.*, si.name as stock_item_name, si.unit, si.current_quantity
    FROM recipe_ingredients ri
    JOIN stock_items si ON si.id = ri.stock_item_id
    WHERE ri.menu_item_id = ?
    ORDER BY si.name
  `).all(req.params.menuItemId);
  res.json(ingredients);
});

// Agregar un insumo a la receta de un plato
router.post('/', (req, res) => {
  const { menu_item_id, stock_item_id, quantity_per_unit } = req.body;
  if (!menu_item_id || !stock_item_id || !quantity_per_unit) {
    return res.status(400).json({ error: 'menu_item_id, stock_item_id y quantity_per_unit son requeridos' });
  }
  const result = db.prepare(
    'INSERT INTO recipe_ingredients (menu_item_id, stock_item_id, quantity_per_unit) VALUES (?, ?, ?)'
  ).run(menu_item_id, stock_item_id, quantity_per_unit);
  res.json({ id: result.lastInsertRowid });
});

// Editar la cantidad de un insumo en una receta
router.put('/:id', (req, res) => {
  const { quantity_per_unit } = req.body;
  if (!quantity_per_unit) return res.status(400).json({ error: 'quantity_per_unit requerido' });
  db.prepare('UPDATE recipe_ingredients SET quantity_per_unit = ? WHERE id = ?').run(quantity_per_unit, req.params.id);
  res.json({ ok: true });
});

// Quitar un insumo de una receta
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM recipe_ingredients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;