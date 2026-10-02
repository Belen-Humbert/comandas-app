const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const { requireAuth, requireRole } = require('./middleware/auth');

// Login (sin protección, es el punto de entrada)
app.use('/api/auth', require('./routes/auth'));

// Rutas de salón: accesibles para 'salon' y 'admin' (cualquier usuario logueado)
app.use('/api/tables', requireAuth, require('./routes/tables'));
app.use('/api/orders', requireAuth, require('./routes/orders'));
app.use('/api/invoices', requireAuth, require('./routes/invoices'));
app.use('/api/reservations', requireAuth, require('./routes/reservations'));
app.use('/api/cash', requireAuth, require('./routes/cash'));

// Menú: cualquier usuario logueado puede VER (GET), pero solo 'admin' puede editar
// (el bloqueo de los POST/PUT/DELETE puntuales se hace dentro de routes/menu.js)
app.use('/api/menu', requireAuth, require('./routes/menu'));

// Rutas exclusivas de la oficina: solo 'admin'
app.use('/api/suppliers', requireAuth, requireRole('admin'), require('./routes/suppliers'));
app.use('/api/stock', requireAuth, requireRole('admin'), require('./routes/stock'));
app.use('/api/reports', requireAuth, requireRole('admin'), require('./routes/reports'));

// Serve frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  Object.values(interfaces).forEach(iface => {
    iface?.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address);
    });
  });
  console.log(`\n🍽️  Comandas App - Backend corriendo`);
  console.log(`   Local:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`   Red:     http://${ip}:${PORT}`));
  console.log('');
});