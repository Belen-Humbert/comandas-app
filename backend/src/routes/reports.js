const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Fechas en hora local. Las comandas se guardan con la hora local del servidor
// (datetime('now','localtime')), así que "hoy" y "este mes" tienen que calcularse igual.
// Con toISOString() (hora UTC) después de las 21 hs en Argentina ya sería "mañana".
const pad = (n) => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localMonth = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// Daily summary
router.get('/daily', (req, res) => {
  const date = req.query.date || localDate();

  const sales = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(total),0) as total_revenue,
           COALESCE(AVG(total),0) as avg_ticket
    FROM orders WHERE status='closed' AND date(closed_at) = ?
  `).get(date);

  const byPayment = db.prepare(`
    SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total),0) as total
    FROM orders WHERE status='closed' AND date(closed_at) = ?
    GROUP BY payment_method
  `).all(date);

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status='closed' AND date(o.closed_at) = ?
    GROUP BY oi.name ORDER BY qty DESC LIMIT 10
  `).all(date);

  const hourlySales = db.prepare(`
    SELECT strftime('%H', closed_at) as hour, COUNT(*) as count, COALESCE(SUM(total),0) as total
    FROM orders WHERE status='closed' AND date(closed_at) = ?
    GROUP BY hour ORDER BY hour
  `).all(date);

  res.json({ date, sales, byPayment, topItems, hourlySales });
});

// Weekly summary
router.get('/weekly', (req, res) => {
  const days = db.prepare(`
    SELECT date(closed_at) as day, COUNT(*) as orders_count, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE status='closed' AND date(closed_at) >= date('now','localtime','-6 days')
    GROUP BY day ORDER BY day
  `).all();

  const total = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(total),0) as total_revenue
    FROM orders WHERE status='closed' AND date(closed_at) >= date('now','localtime','-6 days')
  `).get();

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status='closed' AND date(o.closed_at) >= date('now','localtime','-6 days')
    GROUP BY oi.name ORDER BY qty DESC LIMIT 10
  `).all();

  res.json({ days, total, topItems });
});

// Monthly summary
router.get('/monthly', (req, res) => {
  const month = req.query.month || localMonth();

  const daily = db.prepare(`
    SELECT date(closed_at) as day, COUNT(*) as orders_count, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE status='closed' AND strftime('%Y-%m', closed_at) = ?
    GROUP BY day ORDER BY day
  `).all(month);

  const total = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(total),0) as total_revenue, COALESCE(AVG(total),0) as avg_ticket,
           COALESCE(SUM(persons_count),0) as persons
    FROM orders WHERE status='closed' AND strftime('%Y-%m', closed_at) = ?
  `).get(month);

  const byPayment = db.prepare(`
    SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total),0) as total
    FROM orders WHERE status='closed' AND strftime('%Y-%m', closed_at) = ?
    GROUP BY payment_method
  `).all(month);

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status='closed' AND strftime('%Y-%m', o.closed_at) = ?
    GROUP BY oi.name ORDER BY revenue DESC LIMIT 10
  `).all(month);

  // Ventas por zona (salón / vereda). Las comandas sin zona son de mesas eliminadas o anteriores
  // a que existieran las zonas y no se pudieron ubicar.
  const byZone = db.prepare(`
    SELECT COALESCE(table_zone, 'sin_zona') as zone, COUNT(*) as orders_count,
           COALESCE(SUM(persons_count),0) as persons, COALESCE(SUM(total),0) as revenue,
           COALESCE(AVG(total),0) as avg_ticket
    FROM orders WHERE status='closed' AND strftime('%Y-%m', closed_at) = ?
    GROUP BY zone ORDER BY revenue DESC
  `).all(month);

  // Ventas por mesa. Se agrupa por número de mesa guardado en la comanda, así las mesas
  // eliminadas siguen apareciendo con lo que vendieron en el mes.
  const byTable = db.prepare(`
    SELECT table_number, MAX(table_zone) as zone, COUNT(*) as orders_count,
           COALESCE(SUM(persons_count),0) as persons, COALESCE(SUM(total),0) as revenue,
           COALESCE(AVG(total),0) as avg_ticket
    FROM orders WHERE status='closed' AND strftime('%Y-%m', closed_at) = ?
    GROUP BY table_number ORDER BY revenue DESC, table_number
  `).all(month);

  // Monthly comparison (last 6 months)
  const monthlyHistory = db.prepare(`
    SELECT strftime('%Y-%m', closed_at) as month, COALESCE(SUM(total),0) as revenue, COUNT(*) as orders_count
    FROM orders WHERE status='closed' AND date(closed_at) >= date('now','localtime','-6 months')
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
