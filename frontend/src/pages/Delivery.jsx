import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Search, Plus, Minus, Trash2, Printer, MessageCircle, Bike, ShoppingBag, Check, X } from 'lucide-react';
import { orders, menu, workdays, fmt } from '../lib/api';
import { TYPE_LABELS, PAYMENT_LABELS, printTicket, shareWhatsApp } from '../lib/delivery';
import { useAuth } from '../lib/auth';
import VoidOrderModal from '../components/VoidOrderModal';

// Mixto no se ofrece acá: pide repartir montos y para delivery alcanza con estos tres
const PAYMENT_OPTIONS = ['efectivo', 'transferencia', 'tarjeta'];

const EMPTY_FORM = { order_type: 'delivery', customer_name: '', customer_address: '', notes: '', payment_method: 'efectivo' };

const timeOf = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-');

export default function DeliveryPage() {
  const { isAdmin } = useAuth();
  const [voiding, setVoiding] = useState(null); // pedido que se está por anular
  const [tab, setTab] = useState('new'); // 'new' | 'list'
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState({}); // { [menuItemId]: { item, qty } }
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // pedido recién cargado (para imprimir / compartir)
  const [list, setList] = useState(null); // pedidos de la jornada (null = cargando)

  useEffect(() => {
    Promise.all([menu.categories(), menu.items()])
      .then(([cats, its]) => {
        setCategories(cats);
        setItems(its.filter(i => i.available));
        if (cats.length) setSelectedCat(cats[0].id);
      })
      .catch(e => toast.error(e.message));
  }, []);

  // Pedidos de la jornada actual (o de la última, si todavía no empezó otra)
  const loadList = useCallback(async () => {
    try {
      const [wd] = await workdays.list(1);
      if (!wd) return setList([]);
      setList(await orders.list({ type: 'delivery,takeaway', work_day_id: wd.id }));
    } catch (e) {
      toast.error(e.message);
      setList([]);
    }
  }, []);

  useEffect(() => { if (tab === 'list') loadList(); }, [tab, loadList]);

  const shown = query.trim()
    ? items.filter(i => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items.filter(i => i.category_id === selectedCat);

  const lines = useMemo(() => Object.values(cart), [cart]);
  const total = lines.reduce((s, l) => s + l.qty * l.item.price, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add = (item) => setCart(c => ({ ...c, [item.id]: { item, qty: (c[item.id]?.qty || 0) + 1 } }));
  const change = (id, delta) => setCart(c => {
    const qty = (c[id]?.qty || 0) + delta;
    const next = { ...c };
    if (qty <= 0) delete next[id]; else next[id] = { ...c[id], qty };
    return next;
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isDelivery = form.order_type === 'delivery';
  const missing = !form.customer_name.trim() ? 'Falta el nombre'
    : isDelivery && !form.customer_address.trim() ? 'Falta la dirección'
    : lines.length === 0 ? 'Agregá productos al pedido' : null;

  const submit = async () => {
    if (missing || saving) return;
    setSaving(true);
    let id = null;
    try {
      const created = await orders.createDelivery({
        order_type: form.order_type,
        customer_name: form.customer_name,
        customer_address: isDelivery ? form.customer_address : '',
        notes: form.notes,
        items: lines.map(l => ({ menu_item_id: l.item.id, quantity: l.qty })),
      });
      id = created.id;
      // Se cobra con la misma ruta que las mesas (caja, stock...). Si falla, no queda un pedido colgado.
      try {
        // notes: la ruta de cobro reemplaza las observaciones por lo que reciba, así que se vuelven a mandar
        await orders.close(id, { payment_method: form.payment_method, notes: form.notes.trim() || null });
      } catch (e) {
        await orders.cancel(id).catch(() => {});
        throw e;
      }
      setDone(await orders.get(id));
      setCart({});
      setForm(EMPTY_FORM);
      setQuery('');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const doPrint = async (orderOrId) => {
    try {
      const o = typeof orderOrId === 'object' ? orderOrId : await orders.get(orderOrId);
      if (!printTicket(o)) toast.error('El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes.');
    } catch (e) { toast.error(e.message); }
  };
  const doShare = async (orderOrId) => {
    try {
      const o = typeof orderOrId === 'object' ? orderOrId : await orders.get(orderOrId);
      shareWhatsApp(o);
    } catch (e) { toast.error(e.message); }
  };

  // Un pedido sin cobrar solo puede quedar si se cortó la conexión justo al cobrar: se cancela desde la lista
  const cancelOpen = async (o) => {
    if (!window.confirm(`¿Cancelar el pedido #${o.id} de ${o.customer_name}?`)) return;
    try {
      await orders.cancel(o.id);
      toast.success('Pedido cancelado');
      loadList();
    } catch (e) { toast.error(e.message); }
  };

  const activeCount = list ? list.filter(o => o.status !== 'cancelled').length : null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery / Take Away</h1>
          <p className="text-sm text-gray-500 mt-1">Pedidos sin mesa: se cargan, se cobran y se mandan por WhatsApp</p>
        </div>
        <div className="flex gap-2" role="tablist">
          <button role="tab" aria-selected={tab === 'new'} data-testid="tab-new" onClick={() => setTab('new')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${tab === 'new' ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            Nuevo pedido
          </button>
          <button role="tab" aria-selected={tab === 'list'} data-testid="tab-list" onClick={() => setTab('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${tab === 'list' ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            Pedidos de la jornada{activeCount ? ` (${activeCount})` : ''}
          </button>
        </div>
      </div>

      {tab === 'new' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Menú */}
          <div className="card">
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar en el menú..." className="input pl-9" aria-label="Buscar en el menú" />
            </div>
            {!query && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${selectedCat === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    style={selectedCat === cat.id ? { backgroundColor: cat.color } : {}}>
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
              {shown.map(item => (
                <button key={item.id} onClick={() => add(item)} data-testid={`menu-item-${item.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-amber-300 hover:bg-amber-50 text-left group">
                  <span className="font-medium text-sm text-gray-900">{item.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-amber-600">{fmt.currency(item.price)}</span>
                    <Plus className="w-4 h-4 text-gray-400 group-hover:text-amber-500" />
                  </span>
                </button>
              ))}
              {shown.length === 0 && <p className="text-center text-gray-400 py-8">No hay productos para mostrar</p>}
            </div>
          </div>

          {/* Pedido */}
          <div className="card flex flex-col gap-4" data-testid="order-form">
            <div className="grid grid-cols-2 gap-2">
              {['delivery', 'takeaway'].map(t => (
                <button key={t} onClick={() => set('order_type', t)} aria-pressed={form.order_type === t} data-testid={`type-${t}`}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold ${form.order_type === t ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {t === 'delivery' ? <Bike className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />} {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            <div>
              <label className="label" htmlFor="d-name">Nombre de quien hace el pedido *</label>
              <input id="d-name" className="input" value={form.customer_name} maxLength={100} onChange={e => set('customer_name', e.target.value)} placeholder="Ej: María Gómez" />
            </div>
            {isDelivery && (
              <div>
                <label className="label" htmlFor="d-address">Dirección de entrega *</label>
                <input id="d-address" className="input" value={form.customer_address} maxLength={200} onChange={e => set('customer_address', e.target.value)} placeholder="Calle, número, barrio" />
              </div>
            )}

            <div>
              <p className="label">Pedido</p>
              {lines.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">Elegí productos del menú</p>
              ) : (
                <div className="space-y-2" data-testid="cart">
                  {lines.map(({ item, qty }) => (
                    <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                      <span className="flex-1 min-w-0 text-sm font-medium truncate">{item.name}</span>
                      <button onClick={() => change(item.id, -1)} aria-label={`Menos ${item.name}`} className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <span className="w-6 text-center font-bold text-sm">{qty}</span>
                      <button onClick={() => change(item.id, 1)} aria-label={`Más ${item.name}`} className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                      <span className="w-20 text-right font-bold text-sm">{fmt.currency(qty * item.price)}</span>
                      <button onClick={() => change(item.id, -qty)} aria-label={`Quitar ${item.name}`} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="label" htmlFor="d-notes">Observaciones</label>
              <textarea id="d-notes" className="input" rows={2} maxLength={500} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Algún dato extra: sin cebolla, timbre roto, entre calles..." />
            </div>

            <div>
              <p className="label">Método de pago</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_OPTIONS.map(m => (
                  <button key={m} onClick={() => set('payment_method', m)} aria-pressed={form.payment_method === m} data-testid={`pay-${m}`}
                    className={`py-2 rounded-xl border text-sm font-medium ${form.payment_method === m ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Total ({count} {count === 1 ? 'producto' : 'productos'})</span>
                <span className="text-2xl font-bold text-gray-900" data-testid="cart-total">{fmt.currency(total)}</span>
              </div>
              <button onClick={submit} disabled={!!missing || saving} data-testid="confirm-order" className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <Check className="w-4 h-4" /> {saving ? 'Guardando...' : 'Confirmar y cobrar'}
              </button>
              {missing && <p className="text-xs text-gray-400 text-center mt-2" data-testid="missing">{missing}</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="space-y-3" data-testid="order-list">
          {list === null && <p className="text-center text-gray-400 py-12">Cargando...</p>}
          {list && list.length === 0 && <p className="text-center text-gray-400 py-12">Todavía no hay pedidos de delivery o take away en esta jornada</p>}
          {list && list.map(o => (
            <div key={o.id} className="card flex items-center gap-4 flex-wrap" data-testid={`order-${o.id}`}>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold">#{o.id}</span>
                  <span className={`badge ${o.order_type === 'delivery' ? 'bg-amber-100 text-amber-700' : 'bg-pink-100 text-pink-700'}`}>{TYPE_LABELS[o.order_type]}</span>
                  {o.status === 'cancelled' && (
                    <span className="badge bg-gray-100 text-gray-500" title={o.voided_at ? `Anulado por ${o.voided_by}${o.void_reason ? ': ' + o.void_reason : ''}` : undefined}>
                      {o.voided_at ? 'Anulado' : 'Cancelado'}
                    </span>
                  )}
                  {o.status === 'open' && <span className="badge bg-red-100 text-red-700">Sin cobrar</span>}
                  <span className="text-xs text-gray-400">{timeOf(o.created_at)} hs</span>
                </div>
                <p className="font-medium text-gray-900">{o.customer_name}</p>
                {o.customer_address && <p className="text-sm text-gray-500">{o.customer_address}</p>}
                {o.notes && <p className="text-xs text-gray-400 mt-0.5">Obs: {o.notes}</p>}
                {o.voided_at && <p className="text-xs text-red-500 mt-0.5">Anulado por {o.voided_by}{o.void_reason ? `: ${o.void_reason}` : ''}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{fmt.currency(o.total)}</p>
                <p className="text-xs text-gray-500">{PAYMENT_LABELS[o.payment_method] || '-'} · {o.item_count} {o.item_count === 1 ? 'ítem' : 'ítems'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => doPrint(o.id)} className="btn-secondary btn-sm flex items-center gap-1" aria-label={`Imprimir ticket del pedido ${o.id}`}><Printer className="w-4 h-4" /> Ticket</button>
                <button onClick={() => doShare(o.id)} className="btn-secondary btn-sm flex items-center gap-1" aria-label={`Enviar por WhatsApp el pedido ${o.id}`}><MessageCircle className="w-4 h-4" /> WhatsApp</button>
                {isAdmin && o.status === 'closed' && (
                  <button onClick={() => setVoiding(o)} className="btn-secondary btn-sm text-red-600" aria-label={`Anular el pedido ${o.id}`}>Anular</button>
                )}
                {o.status === 'open' && (
                  <button onClick={() => cancelOpen(o)} className="btn-secondary btn-sm text-red-600" aria-label={`Cancelar el pedido ${o.id}`}>Cancelar pedido</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {voiding && (
        <VoidOrderModal
          order={voiding}
          label={`${TYPE_LABELS[voiding.order_type]} #${voiding.id} (${voiding.customer_name})`}
          onClose={() => setVoiding(null)}
          onDone={() => { setVoiding(null); loadList(); }}
        />
      )}

      {done && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-label="Pedido cargado">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold">Pedido #{done.id} cargado</h2>
                <p className="text-sm text-gray-500">{TYPE_LABELS[done.order_type]} · {done.customer_name} · {fmt.currency(done.total)} ({PAYMENT_LABELS[done.payment_method]})</p>
              </div>
              <button onClick={() => setDone(null)} aria-label="Cerrar"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={() => doPrint(done)} data-testid="print-ticket" className="btn-secondary flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Imprimir ticket</button>
              <button onClick={() => doShare(done)} data-testid="share-whatsapp" className="btn-primary flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp</button>
            </div>
            <button onClick={() => setDone(null)} className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 py-2">Listo, cargar otro pedido</button>
          </div>
        </div>
      )}
    </div>
  );
}
