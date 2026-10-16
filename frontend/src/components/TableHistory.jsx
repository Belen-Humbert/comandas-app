import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X, ChevronDown, ChevronRight, ChevronLeft, Users, ExternalLink } from 'lucide-react';
import { orders, workdays, fmt } from '../lib/api';
import { useAuth } from '../lib/auth';
import VoidOrderModal from './VoidOrderModal';

const STATUS = {
  open: { label: 'En curso', cls: 'bg-blue-100 text-blue-700' },
  closed: { label: 'Cobrada', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
};

const PAYMENT = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', mixto: 'Mixto' };

// SQLite guarda "2026-10-14 22:10:00" (hora local del servidor); se pasa a formato ISO
// para que todos los navegadores lo interpreten igual.
const parseDate = (s) => (s ? new Date(String(s).replace(' ', 'T')) : null);
const dayLabel = (s) => {
  const d = parseDate(s);
  return d ? d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
};
const timeLabel = (s) => {
  const d = parseDate(s);
  return d ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
};
// "miércoles 14 de octubre" a partir de "2026-10-14"
const longDay = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};
const shortDay = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

// El historial se ve por jornada (de que abre el local hasta que se cierra el día),
// no por día del calendario: el cierre puede ser a las 00:50, 01:30, 02:00...
export default function TableHistory({ table, onClose }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [voiding, setVoiding] = useState(null);
  const [tick, setTick] = useState(0); // sube para volver a pedir las comandas (después de anular una)
  const reload = () => setTick(t => t + 1);
  const [days, setDays] = useState(null); // jornadas, la más reciente primero
  const [idx, setIdx] = useState(0);
  const [list, setList] = useState(null); // null = cargando
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null); // id de la comanda abierta
  const [details, setDetails] = useState({}); // { [orderId]: { loading, items, notes } }

  useEffect(() => {
    workdays.list(366)
      .then(setDays)
      .catch(e => { setError(e.message); setDays([]); });
  }, []);

  const wd = days && days[idx];

  // Cada vez que cambia la jornada se vuelven a pedir las comandas de esta mesa
  useEffect(() => {
    if (!wd) { if (days) setList([]); return; }
    let cancelled = false;
    setList(null);
    setError(null);
    setExpanded(null);
    orders.list({ table_id: table.id, work_day_id: wd.id })
      .then(data => { if (!cancelled) setList(data); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [table.id, wd?.id, days, tick]);

  // Cerrar con Escape
  useEffect(() => {
    // Con el aviso de anulación abierto, Escape no debe cerrar también el historial
    const onKey = (e) => { if (e.key === 'Escape' && !voiding) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, voiding]);

  const summary = useMemo(() => {
    if (!list) return null;
    const closed = list.filter(o => o.status === 'closed');
    return {
      count: list.length,
      closedCount: closed.length,
      total: closed.reduce((s, o) => s + (o.total || 0), 0),
    };
  }, [list]);

  const toggle = async (order) => {
    if (expanded === order.id) return setExpanded(null);
    setExpanded(order.id);
    if (details[order.id]) return;
    setDetails(d => ({ ...d, [order.id]: { loading: true } }));
    try {
      const full = await orders.get(order.id);
      setDetails(d => ({ ...d, [order.id]: { loading: false, items: full.items, notes: full.notes } }));
    } catch (e) {
      setDetails(d => ({ ...d, [order.id]: { loading: false, items: [] } }));
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Historial de ${table.name}`}
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h2 className="text-xl font-bold">Historial · {table.name}</h2>
            {wd && (
              <>
                <p className="text-sm text-gray-500 mt-0.5 first-letter:uppercase" data-testid="history-day">
                  {longDay(wd.day)}{wd.status === 'open' && ' (jornada actual)'}
                </p>
                <p className="text-xs text-gray-400" data-testid="history-range">
                  {wd.status === 'open'
                    ? `Desde las ${timeLabel(wd.opened_at)} hs · en curso`
                    : <>De {timeLabel(wd.opened_at)} a {timeLabel(wd.closed_at)} hs{dayLabel(wd.closed_at) !== dayLabel(wd.opened_at) && <> ({dayLabel(wd.closed_at)})</>}</>}
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Navegación por jornada */}
        <div className="flex items-center gap-2 px-5 pb-3 border-b border-gray-100">
          <button
            onClick={() => setIdx(i => i + 1)}
            disabled={!days || idx >= days.length - 1}
            aria-label="Jornada anterior"
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            aria-label="Elegir jornada"
            disabled={!days || days.length === 0}
            className="input w-auto py-1.5 capitalize"
          >
            {(days || []).map((d, i) => (
              <option key={d.id} value={i}>{shortDay(d.day)}{d.status === 'open' ? ' · en curso' : ''}</option>
            ))}
          </select>
          <button
            onClick={() => setIdx(i => i - 1)}
            disabled={idx <= 0}
            aria-label="Jornada siguiente"
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {idx > 0 && (
            <button onClick={() => setIdx(0)} className="btn btn-secondary btn-sm ml-auto">Última</button>
          )}
        </div>

        {summary && (
          <p className="px-5 pt-3 text-sm text-gray-500" data-testid="history-summary">
            {summary.count} {summary.count === 1 ? 'comanda' : 'comandas'}
            {summary.closedCount > 0 && <> · {fmt.currency(summary.total)} cobrados</>}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="text-center text-red-500 py-10">{error}</p>}
          {!error && (list === null || days === null) && <p className="text-center text-gray-400 py-10">Cargando...</p>}
          {list && days && list.length === 0 && (
            <p className="text-center text-gray-400 py-10">{days.length === 0 ? 'Todavía no hay jornadas registradas' : 'No hubo comandas en esta mesa en esta jornada'}</p>
          )}

          {list && list.map(order => {
            const st = STATUS[order.status] || STATUS.closed;
            const open = expanded === order.id;
            const det = details[order.id];
            return (
              <div key={order.id} className="border border-gray-100 rounded-xl mb-2 overflow-hidden">
                <button
                  onClick={() => toggle(order)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50"
                >
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{timeLabel(order.created_at)} hs</p>
                    <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-0.5"><Users className="w-3 h-3" />{order.persons_count} pers.</span>
                      <span>{order.item_count} {order.item_count === 1 ? 'ítem' : 'ítems'}</span>
                      {order.status === 'closed' && order.payment_method && <span>{PAYMENT[order.payment_method] || order.payment_method}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold ${order.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{fmt.currency(order.total)}</p>
                    <span className={`badge ${st.cls}`}>{order.voided_at ? 'Anulada' : st.label}</span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm">
                    {(!det || det.loading) && <p className="text-gray-400">Cargando detalle...</p>}
                    {det && !det.loading && det.items && det.items.length === 0 && <p className="text-gray-400">Sin ítems cargados</p>}
                    {det && !det.loading && det.items && det.items.map(it => (
                      <div key={it.id} className="flex justify-between gap-3 py-0.5">
                        <span className="text-gray-700">
                          {it.quantity} × {it.name}
                          {it.notes && <span className="text-gray-400"> ({it.notes})</span>}
                        </span>
                        <span className="text-gray-600 flex-shrink-0">{fmt.currency(it.quantity * it.unit_price)}</span>
                      </div>
                    ))}
                    {det && det.notes && <p className="text-xs text-gray-500 mt-2">Nota: {det.notes}</p>}
                    {order.closed_at && order.status !== 'open' && (
                      <p className="text-xs text-gray-400 mt-2">
                        {order.status === 'closed' ? 'Cobrada' : 'Cancelada'} a las {timeLabel(order.closed_at)}
                        {dayLabel(order.closed_at) !== dayLabel(order.created_at) && <> del {dayLabel(order.closed_at)}</>}
                      </p>
                    )}
                    {order.voided_at && (
                      <p className="text-xs text-red-500 mt-1">Anulada por {order.voided_by}{order.void_reason ? `: ${order.void_reason}` : ''}</p>
                    )}
                    {isAdmin && order.status === 'closed' && (
                      <button
                        onClick={() => setVoiding(order)}
                        className="mt-3 text-sm text-red-600 font-medium hover:underline"
                      >
                        Anular comanda
                      </button>
                    )}
                    {order.status === 'open' && (
                      <button
                        onClick={() => navigate(`/order/${order.id}`)}
                        className="mt-3 inline-flex items-center gap-1.5 text-amber-600 font-medium hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Ir a la comanda
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {voiding && (
        <VoidOrderModal
          order={voiding}
          label={`${table.name} · comanda #${voiding.id}`}
          onClose={() => setVoiding(null)}
          onDone={() => { setVoiding(null); reload(); }}
        />
      )}
    </div>
  );
}
