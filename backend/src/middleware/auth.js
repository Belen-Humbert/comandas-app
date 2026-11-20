const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db/database');

// Secreto con el que se firman las sesiones. Ya no está escrito en el código:
// 1) si existe la variable de entorno JWT_SECRET, se usa esa;
// 2) si no, se genera uno al azar la primera vez y se guarda en backend/data/jwt-secret
//    (la carpeta data/ no se sube a GitHub), así las sesiones sobreviven a los reinicios.
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/comandas.db');
  const dir = path.dirname(dbPath);
  const file = path.join(dir, 'jwt-secret');
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved.length >= 32) return saved;
  } catch (e) { /* todavía no existe: se crea abajo */ }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
const JWT_SECRET = loadSecret();

// Mientras el usuario tenga la contraseña inicial, solo puede cambiarla (o ver quién es)
const ALLOWED_WHEN_MUST_CHANGE = ['/api/auth/password', '/api/auth/me'];

// Verifica que venga un token válido en el header Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Se confirma en la base: un usuario desactivado pierde el acceso al instante (no a las 12 hs)
  // y el rol que vale es el actual, no el que tenía cuando inició sesión.
  const user = db.prepare('SELECT id, username, role, full_name, active, must_change_password FROM users WHERE id = ?').get(payload.id);
  if (!user || !user.active) return res.status(401).json({ error: 'Usuario no habilitado' });
  req.user = { id: user.id, username: user.username, role: user.role, full_name: user.full_name, must_change_password: !!user.must_change_password };

  if (req.user.must_change_password && !ALLOWED_WHEN_MUST_CHANGE.some(p => req.originalUrl.split('?')[0] === p)) {
    return res.status(403).json({ error: 'Tenés que cambiar la contraseña inicial antes de seguir', code: 'must_change_password' });
  }
  next();
}

// Uso: requireRole('admin') o requireRole('admin', 'salon')
// Debe usarse SIEMPRE después de requireAuth (necesita req.user ya seteado)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tenés permiso para realizar esta acción' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };