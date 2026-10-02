const jwt = require('jsonwebtoken');

// En producción esto debería venir de una variable de entorno (.env), no quedar hardcodeado.
const JWT_SECRET = process.env.JWT_SECRET || 'comandas-app-secret-cambiar-en-produccion';

// Verifica que venga un token válido en el header Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
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