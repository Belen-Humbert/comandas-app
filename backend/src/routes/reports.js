const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Daily summary
router.get('/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];

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
    FROM orders WHERE status='closed' AND date(closed_at) >= date('now','-6 days')
    GROUP BY day ORDER BY day
  `).all();

  const total = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(total),0) as total_revenue
    FROM orders WHERE status='closed' AND date(closed_at) >= date('now','-6 days')
  `).get();

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status='closed' AND date(o.closed_at) >= date('now','-6 days')
    GROUP BY oi.name ORDER BY qty DESC LIMIT 10
  `).all();

  res.json({ days, total, topItems });
});

// Monthly summary
router.get('/monthly', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const daily = db.prepare(`
    SELECT date(closed_at) as day, COUNT(*) as orders_count, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE status='closed' AND strftime('%Y-%m', closed_at) = ?
    GROUP BY day ORDER BY day
  `).all(month);

  const total = db.prepare(`
    SELECT COUNT(*) as orders_count, COALESCE(SUM(total),0) as total_revenue, COALESCE(AVG(total),0) as avg_ticket
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

  // Monthly comparison (last 6 months)
  const monthlyHistory = db.prepare(`
    SELECT strftime('%Y-%m', closed_at) as month, COALESCE(SUM(total),0) as revenue, COUNT(*) as orders_count
    FROM orders WHERE status='closed' AND date(closed_at) >= date('now','-6 months')
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

  res.json({ month, daily, total, byPayment, topItems, monthlyHistory, supplierCosts, pettyCashIn, pettyCashOut });
});

module.exports = router;
