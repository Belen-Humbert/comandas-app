import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { UtensilsCrossed, LogIn } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return toast.error('Ingresá usuario y contraseña');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      toast.error(err.message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mb-3">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Comandas</h1>
          <p className="text-sm text-gray-500">Iniciá sesión para continuar</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="username">Usuario</label>
            <input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              autoComplete="current-password"
            />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full mt-6 flex items-center justify-center gap-2">
          <LogIn className="w-4 h-4" />
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
