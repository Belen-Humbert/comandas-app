const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET, requireAuth, requireRole } = require('../middleware/auth');

// Login: cualquiera con usuario y contraseña válidos recibe un token
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name }
  });
});

// Devuelve los datos del usuario logueado (útil para el frontend al cargar la página)
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// Cambiar la contraseña propia: pide la actual (por si alguien deja la sesión abierta).
// Se responde 400 y no 401 si la actual está mal, porque un 401 cierra la sesión en el frontend.
router.post('/password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Completá la contraseña actual y la nueva' });
  }
  if (typeof new_password !== 'string' || new_password.length < 6) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' });
  }
  if (new_password.length > 72) {
    return res.status(400).json({ error: 'La contraseña nueva es demasiado larga (máximo 72 caracteres)' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
  if (!bcrypt.compareSync(String(current_password), user.password_hash)) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }
  if (current_password === new_password) {
    return res.status(400).json({ error: 'La contraseña nueva tiene que ser distinta de la actual' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), user.id);
  res.json({ ok: true });
});

// Listar usuarios (solo admin, para una futura pantalla de "Gestión de personal")
router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, username, role, full_name, active FROM users ORDER BY username').all();
  res.json(users);
});

// Crear un nuevo usuario (solo admin puede dar de alta mozos/encargados)
router.post('/users', requireAuth, requireRole('admin'), (req, res) => {
  const { username, password, role, full_name } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos' });
  }
  if (!['salon', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)'
    ).run(username, password_hash, role, full_name || null);
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'El nombre de usuario ya existe' });
  }
});

// Desactivar un usuario (no lo borra, para no romper el historial de comandas/cobros que hizo)
router.put('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { full_name, role, active } = req.body;
  db.prepare('UPDATE users SET full_name=?, role=?, active=? WHERE id=?')
    .run(full_name, role, active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;