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

// API routes
app.use('/api/tables', require('./routes/tables'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/cash', require('./routes/cash'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/reports', require('./routes/reports'));

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
