import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, Edit2, UserCheck, UserX } from 'lucide-react';
import { auth } from '../lib/api';
import { useAuth } from '../lib/auth';

const ROLES = [
  { value: 'salon', label: 'Salón' },
  { value: 'admin', label: 'Administrador' },
];

const EMPTY_FORM = { username: '', password: '', full_name: '', role: 'salon', active: true };

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => setUsers(await auth.listUsers());
  useEffect(() => { load().catch(e => toast.error(e.message)); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ username: u.username, password: '', full_name: u.full_name || '', role: u.role, active: !!u.active });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await auth.updateUser(editing.id, { full_name: form.full_name, role: form.role, active: form.active });
        toast.success('Usuario actualizado');
      } else {
        if (!form.username || !form.password) return toast.error('Usuario y contraseña requeridos');
        await auth.createUser({ username: form.username.trim(), password: form.password, role: form.role, full_name: form.full_name });
        toast.success('Usuario creado');
      }
      setShowModal(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const toggleActive = async (u) => {
    if (u.id === me.id) return toast.error('No podés desactivar tu propio usuario');
    try {
      await auth.updateUser(u.id, { full_name: u.full_name, role: u.role, active: !u.active });
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Personal</h1>
          <p className="text-sm text-gray-500">Usuarios con acceso al sistema</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3">{u.full_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {ROLES.find(r => r.value === u.role)?.label || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(u)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(u)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title={u.active ? 'Desactivar' : 'Activar'}>
                      {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Usuario *</label>
                <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="input"
                  disabled={!!editing}
                  autoCapitalize="none"
                />
              </div>
              {!editing && (
                <div>
                  <label className="label">Contraseña *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="input"
                    autoComplete="new-password"
                  />
                </div>
              )}
              <div>
                <label className="label">Nombre completo</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="input"
                  disabled={editing?.id === me.id}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
