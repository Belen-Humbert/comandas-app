const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Fechas en hora local. Las comandas se guardan con la hora local del servidor
// (datetime('now','localtime')), así que "hoy" y "este mes" tienen que calcularse igual.
// Con toISOString() (hora UTC) después de las 21 hs en Argentina ya sería "mañana".
const pad = (n) => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localMonth = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// "Día" de una comanda = día en que empezó su jornada (no el del calendario en que se cobró):
// una venta de la 01:00 am pertenece a la jornada del día anterior. Si no tuviera jornada
// (no debería pasar) se usa la fecha de cobro.
const FROM = 'orders o LEFT JOIN work_days w ON w.id = o.work_day_id';
const BD = "COALESCE(date(w.opened_at), date(o.closed_at))";

// Fecha por defecto del reporte diario: la jornada abierta, o la última que hubo
const defaultDate = () => {
  const w = db.prepare("SELECT date(opened_at) AS d FROM work_days ORDER BY (status = 'open') DESC, id DESC LIMIT 1").get();
  return w ? w.d : localDate();
};

// Daily summary
router.get('/daily', (req, res) => {
  const date = req.query.date || defaultDate();

  const sales = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(o.total),0) as total_revenue,
           COALESCE(AVG(o.total),0) as avg_ticket
    FROM ${FROM} WHERE o.status='closed' AND ${BD} = ?
  `).get(date);

  const byPayment = db.prepare(`
    SELECT o.payment_method, COUNT(*) as count, COALESCE(SUM(o.total),0) as total
    FROM ${FROM} WHERE o.status='closed' AND ${BD} = ?
    GROUP BY o.payment_method
  `).all(date);

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN work_days w ON w.id = o.work_day_id
    WHERE o.status='closed' AND ${BD} = ?
    GROUP BY oi.name ORDER BY qty DESC LIMIT 10
  `).all(date);

  const hourlySales = db.prepare(`
    SELECT strftime('%H', o.closed_at) as hour, COUNT(*) as count, COALESCE(SUM(o.total),0) as total
    FROM ${FROM} WHERE o.status='closed' AND ${BD} = ?
    GROUP BY hour ORDER BY (CAST(hour AS INTEGER) + 18) % 24
  `).all(date);

  res.json({ date, sales, byPayment, topItems, hourlySales });
});

// Weekly summary
router.get('/weekly', (req, res) => {
  const days = db.prepare(`
    SELECT ${BD} as day, COUNT(*) as orders_count, COALESCE(SUM(o.total),0) as revenue
    FROM ${FROM} WHERE o.status='closed' AND ${BD} >= date('now','localtime','-6 days')
    GROUP BY day ORDER BY day
  `).all();

  const total = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(o.total),0) as total_revenue
    FROM ${FROM} WHERE o.status='closed' AND ${BD} >= date('now','localtime','-6 days')
  `).get();

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN work_days w ON w.id = o.work_day_id
    WHERE o.status='closed' AND ${BD} >= date('now','localtime','-6 days')
    GROUP BY oi.name ORDER BY qty DESC LIMIT 10
  `).all();

  res.json({ days, total, topItems });
});

// Monthly summary
router.get('/monthly', (req, res) => {
  const month = req.query.month || localMonth();

  const daily = db.prepare(`
    SELECT ${BD} as day, COUNT(*) as orders_count, COALESCE(SUM(o.total),0) as revenue
    FROM ${FROM} WHERE o.status='closed' AND strftime('%Y-%m', ${BD}) = ?
    GROUP BY day ORDER BY day
  `).all(month);

  const total = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(o.total),0) as total_revenue, COALESCE(AVG(o.total),0) as avg_ticket,
           COALESCE(SUM(o.persons_count),0) as persons
    FROM ${FROM} WHERE o.status='closed' AND strftime('%Y-%m', ${BD}) = ?
  `).get(month);

  const byPayment = db.prepare(`
    SELECT o.payment_method, COUNT(*) as count, COALESCE(SUM(o.total),0) as total
    FROM ${FROM} WHERE o.status='closed' AND strftime('%Y-%m', ${BD}) = ?
    GROUP BY o.payment_method
  `).all(month);

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN work_days w ON w.id = o.work_day_id
    WHERE o.status='closed' AND strftime('%Y-%m', ${BD}) = ?
    GROUP BY oi.name ORDER BY revenue DESC LIMIT 10
  `).all(month);

  // Ventas por zona (salón / vereda). Las comandas sin zona son de mesas eliminadas o anteriores
  // a que existieran las zonas y no se pudieron ubicar.
  const byZone = db.prepare(`
    SELECT COALESCE(o.table_zone, 'sin_zona') as zone, COUNT(*) as orders_count,
           COALESCE(SUM(o.persons_count),0) as persons, COALESCE(SUM(o.total),0) as revenue,
           COALESCE(AVG(o.total),0) as avg_ticket
    FROM ${FROM} WHERE o.status='closed' AND strftime('%Y-%m', ${BD}) = ?
    GROUP BY zone ORDER BY revenue DESC
  `).all(month);

  // Ventas por mesa. Se agrupa por número de mesa guardado en la comanda, así las mesas
  // eliminadas siguen apareciendo con lo que vendieron en el mes.
  const byTable = db.prepare(`
    SELECT o.table_number, MAX(o.table_zone) as zone, COUNT(*) as orders_count,
           COALESCE(SUM(o.persons_count),0) as persons, COALESCE(SUM(o.total),0) as revenue,
           COALESCE(AVG(o.total),0) as avg_ticket
    FROM ${FROM} WHERE o.status='closed' AND strftime('%Y-%m', ${BD}) = ?
    GROUP BY o.table_number ORDER BY revenue DESC, o.table_number
  `).all(month);

  // Monthly comparison (last 6 months)
  const monthlyHistory = db.prepare(`
    SELECT strftime('%Y-%m', ${BD}) as month, COALESCE(SUM(o.total),0) as revenue, COUNT(*) as orders_count
    FROM ${FROM} WHERE o.status='closed' AND ${BD} >= date('now','localtime','-6 months')
    GROUP BY month ORDER BY month
  `).all();

  // Supplier costs for the month
  const supplierCosts = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM supplier_payments
    WHERE status='paid' AND strftime('%Y-%m', date) = ?
  `).get(month);

  // Petty cash for the month
  const pettyCashIn = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM petty_cash WHERE type='in' AND strftime('%Y-%m', date) = ?`).get(month);
  const pettyCashOut = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM petty_cash WHERE type='out' AND strftime('%Y-%m', date) = ?`).get(month);

  res.json({ month, daily, total, byPayment, topItems, byZone, byTable, monthlyHistory, supplierCosts, pettyCashIn, pettyCashOut });
});

module.exports = router;
