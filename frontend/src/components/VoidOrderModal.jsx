import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X, AlertTriangle } from 'lucide-react';
import { orders, fmt } from '../lib/api';

// Anular un pedido ya cobrado (solo admin). Pide confirmación y un motivo opcional.
// `label` es cómo se nombra el pedido en el aviso ("Delivery #8", "Mesa 5 · comanda #12").
export default function VoidOrderModal({ order, label, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      const r = await orders.void(order.id, reason);
      const extra = [];
      if (r.cash_reversed > 0) extra.push(`se sacaron ${fmt.currency(r.cash_reversed)} de la caja`);
      if (r.stock_restored > 0) extra.push('se repuso el stock');
      toast.success(`Pedido anulado${extra.length ? ': ' + extra.join(' y ') : ''}`);
      if (r.cash_pending > 0) {
        toast(`No hay una caja abierta: quedaron ${fmt.currency(r.cash_pending)} en efectivo sin devolver en caja.`, { icon: '⚠️', duration: 7000 });
      }
      onDone();
    } catch (e) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !saving && onClose()}>
      <div role="dialog" aria-label="Anular pedido" onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /> Anular pedido</h2>
          <button onClick={onClose} disabled={saving} aria-label="Cerrar"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-700">
          Vas a anular <strong>{label}</strong> por <strong>{fmt.currency(order.total)}</strong>.
        </p>
        <ul className="text-sm text-gray-600 mt-2 list-disc pl-5 space-y-0.5" data-testid="void-effects">
          <li>Deja de contar en las ventas y en las estadísticas.</li>
          <li>Si se cobró en efectivo, se saca de la caja abierta.</li>
          <li>Se repone el stock que se descontó.</li>
          <li>Queda registrado en el historial como <em>Anulada</em>. No se puede deshacer.</li>
        </ul>
        <label className="label mt-4" htmlFor="void-reason">Motivo (opcional)</label>
        <input id="void-reason" className="input" maxLength={200} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: se cargó el pedido dos veces" autoFocus />
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">Volver</button>
          <button onClick={confirm} disabled={saving} data-testid="void-confirm" className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50">
            {saving ? 'Anulando...' : 'Sí, anular pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
