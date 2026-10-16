import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X, KeyRound } from 'lucide-react';
import { auth } from '../lib/api';

// Cambio de la contraseña propia: pide la actual, la nueva y repetir la nueva
export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(null); };

  const problem = !form.current ? 'Escribí tu contraseña actual'
    : form.next.length < 6 ? 'La contraseña nueva debe tener al menos 6 caracteres'
    : form.next !== form.repeat ? 'Las contraseñas nuevas no coinciden'
    : null;

  const submit = async (e) => {
    e.preventDefault();
    if (problem || saving) return;
    setSaving(true);
    try {
      await auth.changePassword(form.current, form.next);
      toast.success('Contraseña cambiada');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Cambiar contraseña"
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-500" /> Cambiar contraseña</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="pw-current">Contraseña actual</label>
            <input id="pw-current" type="password" autoComplete="current-password" className="input" value={form.current} onChange={e => set('current', e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="pw-new">Contraseña nueva</label>
            <input id="pw-new" type="password" autoComplete="new-password" className="input" value={form.next} onChange={e => set('next', e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="label" htmlFor="pw-repeat">Repetir contraseña nueva</label>
            <input id="pw-repeat" type="password" autoComplete="new-password" className="input" value={form.repeat} onChange={e => set('repeat', e.target.value)} />
          </div>
        </div>
        {error && <p role="alert" data-testid="pw-error" className="mt-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5">{error}</p>}
        {!error && problem && (form.current || form.next || form.repeat) && <p data-testid="pw-hint" className="mt-3 text-xs text-gray-400">{problem}</p>}
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={!!problem || saving} data-testid="pw-submit" className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
