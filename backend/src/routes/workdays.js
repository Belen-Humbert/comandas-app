const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Jornada abierta (si hay una). Las comandas nuevas se anotan siempre en la jornada abierta.
const currentWorkDay = () =>
  db.prepare("SELECT * FROM work_days WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();

// Devuelve la jornada abierta; si no hay ninguna, abre una nueva (con la primera comanda del turno)
const STALE_HOURS = 20;
const ensureWorkDay = () => {
  let open = currentWorkDay();
  // Si se olvidaron de cerrar la jornada, una que lleva más de 20 hs abierta (y sin mesas abiertas)
  // se cierra sola, a la hora de su último movimiento, para que la comanda nueva arranque una jornada nueva.
  if (open) {
    const stale = db.prepare(`
      SELECT (julianday('now','localtime') - julianday(?)) * 24 > ? AS old,
             (SELECT COUNT(*) FROM orders WHERE work_day_id = ? AND status = 'open') AS pending,
             (SELECT MAX(COALESCE(closed_at, created_at)) FROM orders WHERE work_day_id = ?) AS last_at
    `).get(open.opened_at, STALE_HOURS, open.id, open.id);
    if (stale.old && stale.pending === 0) {
      db.prepare("UPDATE work_days SET status = 'closed', closed_at = COALESCE(?, opened_at), closed_by = 'automático' WHERE id = ?")
        .run(stale.last_at, open.id);
      open = null;
    }
  }
  if (open) return open;
  const id = db.prepare("INSERT INTO work_days (status) VALUES ('open')").run().lastInsertRowid;
  return db.prepare('SELECT * FROM work_days WHERE id = ?').get(id);
};

const SUMMARY_SELECT = `
  SELECT w.*, date(w.opened_at) AS day,
         COUNT(o.id) AS orders_count,
         COALESCE(SUM(o.status = 'closed'), 0) AS closed_count,
         COALESCE(SUM(o.status = 'open'), 0) AS open_orders,
         COALESCE(SUM(CASE WHEN o.status = 'closed' THEN o.total END), 0) AS total
  FROM work_days w
  LEFT JOIN orders o ON o.work_day_id = w.id
`;

// Jornada abierta con su resumen (o { current: null } si todavía no empezó)
router.get('/current', (req, res) => {
  const open = currentWorkDay();
  if (!open) return res.json({ current: null });
  res.json({ current: db.prepare(SUMMARY_SELECT + ' WHERE w.id = ? GROUP BY w.id').get(open.id) });
});

// Lista de jornadas, la más reciente primero (para navegar el historial)
router.get('/', (req, res) => {
  const n = req.query.limit === undefined ? 90 : Number(req.query.limit);
  if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'Límite inválido' });
  res.json(db.prepare(SUMMARY_SELECT + ' GROUP BY w.id ORDER BY w.id DESC LIMIT ?').all(Math.min(n, 500)));
});

// Cerrar la jornada: no se puede si quedan comandas abiertas
router.post('/close', (req, res) => {
  const open = currentWorkDay();
  if (!open) return res.status(400).json({ error: 'No hay una jornada abierta' });

  const pending = db.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE work_day_id = ? AND status = 'open'"
  ).get(open.id).n;
  if (pending > 0) {
    return res.status(409).json({
      error: `Todavía hay ${pending} ${pending === 1 ? 'mesa con comanda abierta' : 'mesas con comanda abierta'}. Cobrá o cancelá las comandas antes de cerrar la jornada.`,
      open_orders: pending,
    });
  }

  db.prepare("UPDATE work_days SET status = 'closed', closed_at = datetime('now','localtime'), closed_by = ? WHERE id = ?")
    .run(req.user?.username || null, open.id);
  res.json(db.prepare(SUMMARY_SELECT + ' WHERE w.id = ? GROUP BY w.id').get(open.id));
});

module.exports = router;
module.exports.ensureWorkDay = ensureWorkDay;
