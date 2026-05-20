import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, Plus, Minus, Trash2, Printer, CreditCard, X, Users, ChevronDown } from 'lucide-react';
import { orders, menu, invoices, fmt } from '../lib/api';

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'mixto', label: 'Mixto' },
];

export default function OrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showClose, setShowClose] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [selectedPerson, setSelectedPerson] = useState(0);
  const [invoiceData, setInvoiceData] = useState({ customer_name: '', customer_tax_id: '' });
  const searchRef = useRef(null);

  const loadOrder = useCallback(async () => {
    try {
      const data = await orders.get(id);
      setOrder(data);
    } catch (e) {
      toast.error(e.message);
      navigate('/');
    }
  }, [id]);

  const loadMenu = useCallback(async () => {
    const [cats, items] = await Promise.all([menu.categories(), menu.items()]);
    setAllCategories(cats);
    setAllItems(items.filter(i => i.available));
    if (cats.length > 0 && !selectedCategory) setSelectedCategory(cats[0].id);
  }, []);

  useEffect(() => { loadOrder(); loadMenu(); }, [loadOrder, loadMenu]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    setSearchResults(allItems.filter(i => i.name.toLowerCase().includes(q)));
  }, [searchQuery, allItems]);

  const displayedItems = searchQuery.trim()
    ? searchResults
    : allItems.filter(i => i.category_id === selectedCategory);

  const addItem = async (item) => {
    try {
      await orders.addItems(id, [{ menu_item_id: item.id, name: item.name, unit_price: item.price, quantity: 1, person_number: selectedPerson }]);
      await loadOrder();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateQty = async (item, delta) => {
    const newQty = item.quantity + delta;
    try {
      await orders.updateItem(id, item.id, { quantity: newQty, notes: item.notes, person_number: item.person_number });
      await loadOrder();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await orders.deleteItem(id, itemId);
      await loadOrder();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handlePrintKitchen = async () => {
    await orders.print(id);
    const win = window.open('', '_blank', 'width=400,height=600');
    const unprinted = order.items.filter(i => !i.printed);
    win.document.write(buildKitchenTicket(order, unprinted.length ? unprinted : order.items));
    win.document.close();
    win.print();
    await loadOrder();
  };

  const handleClose = async () => {
    try {
      await orders.close(id, { payment_method: paymentMethod });
      toast.success('Mesa cerrada');
      navigate('/');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleCreateInvoice = async () => {
    try {
      const result = await invoices.create({ order_id: parseInt(id), ...invoiceData });
      toast.success(`Factura ${result.number || ''} generada`);
      setShowInvoice(false);
      printInvoice(result.id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const printInvoice = async (invoiceId) => {
    const inv = await invoices.get(invoiceId);
    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(buildInvoiceHTML(inv));
    win.document.close();
    win.print();
  };

  const printComanda = () => {
    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(buildComandaHTML(order));
    win.document.close();
    win.print();
  };

  if (!order) return <div className="flex items-center justify-center h-screen text-gray-400">Cargando...</div>;

  const itemsByPerson = order.persons_count > 1
    ? Array.from({ length: order.persons_count }, (_, i) => ({
        person: i + 1,
        items: order.items.filter(it => it.person_number === i + 1),
      }))
    : null;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left: Menu */}
      <div className="flex flex-col w-1/2 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-gray-900">Mesa {order.table_number}</h1>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Users className="w-3 h-3" /> {order.persons_count} personas
              </span>
            </div>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar en el menú..."
              className="input pl-9"
            />
          </div>
          {/* Category tabs */}
          {!searchQuery && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {allCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  style={selectedCategory === cat.id ? { backgroundColor: cat.color } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Person selector when multiple */}
        {order.persons_count > 1 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 font-medium">Agregar para:</span>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setSelectedPerson(0)} className={`px-2 py-1 rounded text-xs ${selectedPerson === 0 ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}>Mesa</button>
                {Array.from({ length: order.persons_count }, (_, i) => (
                  <button key={i} onClick={() => setSelectedPerson(i + 1)} className={`px-2 py-1 rounded text-xs ${selectedPerson === i + 1 ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}>P{i + 1}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 gap-2">
          {displayedItems.map(item => (
            <button key={item.id} onClick={() => addItem(item)} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-amber-300 hover:bg-amber-50 transition-all text-left group">
              <div>
                <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-600">{fmt.currency(item.price)}</span>
                <Plus className="w-4 h-4 text-gray-400 group-hover:text-amber-500" />
              </div>
            </button>
          ))}
          {displayedItems.length === 0 && (
            <p className="text-center text-gray-400 py-8">No hay items para mostrar</p>
          )}
        </div>
      </div>

      {/* Right: Order */}
      <div className="flex flex-col w-1/2">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Comanda #{order.id}</h2>
            <button onClick={handlePrintKitchen} className="btn-secondary btn-sm flex items-center gap-1">
              <Printer className="w-4 h-4" /> Cocina
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {order.items.length === 0 && (
            <p className="text-center text-gray-400 py-12">Seleccioná productos del menú</p>
          )}
          {order.items.map(item => (
            <div key={item.id} className={`flex items-center gap-3 bg-white rounded-xl p-3 border ${item.printed ? 'border-gray-100' : 'border-amber-200'}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{fmt.currency(item.unit_price)} c/u</span>
                  {item.person_number > 0 && <span className="badge bg-amber-100 text-amber-700">P{item.person_number}</span>}
                  {item.printed && <span className="badge bg-green-100 text-green-700">Impreso</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item, -1)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                <button onClick={() => updateQty(item, 1)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="font-bold text-sm w-20 text-right">{fmt.currency(item.quantity * item.unit_price)}</span>
              <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600">Total</span>
            <span className="text-2xl font-bold text-gray-900">{fmt.currency(order.total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={printComanda} className="btn-secondary flex items-center justify-center gap-1">
              <Printer className="w-4 h-4" /> Comanda
            </button>
            <button onClick={() => setShowInvoice(true)} className="btn-secondary flex items-center justify-center gap-1">
              Factura
            </button>
          </div>
          <button onClick={() => setShowClose(true)} className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
            <CreditCard className="w-4 h-4" /> Cerrar Mesa
          </button>
        </div>
      </div>

      {/* Close Modal */}
      {showClose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Cerrar Mesa {order.table_number}</h2>
              <button onClick={() => setShowClose(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Order summary */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <span className="text-gray-700">{item.quantity}x {item.name}</span>
                  <span className="font-medium">{fmt.currency(item.quantity * item.unit_price)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-lg">{fmt.currency(order.total)}</span>
              </div>
            </div>

            {/* Split by person */}
            {itemsByPerson && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Cobro por persona:</p>
                <div className="space-y-1">
                  {itemsByPerson.map(({ person, items: pItems }) => {
                    const subtotal = pItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
                    const sharedItems = order.items.filter(i => i.person_number === 0);
                    const sharedPer = sharedItems.reduce((s, i) => s + i.quantity * i.unit_price, 0) / order.persons_count;
                    return (
                      <div key={person} className="flex justify-between text-sm bg-amber-50 px-3 py-1.5 rounded-lg">
                        <span>Persona {person}</span>
                        <span className="font-medium">{fmt.currency(subtotal + sharedPer)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="label">Forma de pago</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${paymentMethod === m.value ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowClose(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleClose} className="btn-success flex-1 flex items-center justify-center gap-1">
                <CreditCard className="w-4 h-4" /> Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Generar Factura</h2>
              <button onClick={() => setShowInvoice(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre del cliente (opcional)</label>
                <input value={invoiceData.customer_name} onChange={e => setInvoiceData(d => ({ ...d, customer_name: e.target.value }))} className="input" placeholder="Nombre..." />
              </div>
              <div>
                <label className="label">CUIT / DNI (opcional)</label>
                <input value={invoiceData.customer_tax_id} onChange={e => setInvoiceData(d => ({ ...d, customer_tax_id: e.target.value }))} className="input" placeholder="20-12345678-9" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex justify-between">
                <span className="text-gray-600">Total a facturar</span>
                <span className="font-bold">{fmt.currency(order.total)}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowInvoice(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreateInvoice} className="btn-primary flex-1 flex items-center justify-center gap-1">
                <Printer className="w-4 h-4" /> Generar e Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildKitchenTicket(order, items) {
  const now = new Date().toLocaleString('es-AR');
  return `<html><head><style>
    body{font-family:monospace;font-size:14px;padding:10px;max-width:300px}
    h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px}
    .item{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #ccc}
    .footer{text-align:center;margin-top:12px;font-size:12px;color:#666}
  </style></head><body>
    <h2>** COCINA **</h2>
    <p>Mesa: <strong>${order.table_number}</strong> | Personas: ${order.persons_count}</p>
    <p>Comanda #${order.id} | ${now}</p>
    <hr/>
    ${items.map(i => `<div class="item"><span>${i.quantity}x ${i.name}${i.person_number > 0 ? ` (P${i.person_number})` : ''}${i.notes ? `<br><small><i>${i.notes}</i></small>` : ''}</span></div>`).join('')}
    <div class="footer">--- Fin de comanda ---</div>
  </body></html>`;
}

function buildComandaHTML(order) {
  const now = new Date().toLocaleString('es-AR');
  return `<html><head><style>
    body{font-family:monospace;font-size:14px;padding:10px;max-width:300px}
    h2{text-align:center}
    .item{display:flex;justify-content:space-between;padding:3px 0}
    .total{display:flex;justify-content:space-between;font-weight:bold;font-size:16px;border-top:2px solid #000;margin-top:8px;padding-top:8px}
    .footer{text-align:center;margin-top:12px;font-size:11px;color:#666}
  </style></head><body>
    <h2>COMANDA</h2>
    <p>Mesa: <strong>${order.table_number}</strong> | ${now}</p>
    <hr/>
    ${order.items.map(i => `<div class="item"><span>${i.quantity}x ${i.name}</span><span>$${(i.quantity * i.unit_price).toLocaleString('es-AR')}</span></div>`).join('')}
    <div class="total"><span>TOTAL</span><span>$${Number(order.total).toLocaleString('es-AR')}</span></div>
    <div class="footer">Gracias por su visita</div>
  </body></html>`;
}

function buildInvoiceHTML(inv) {
  const now = new Date().toLocaleString('es-AR');
  return `<html><head><style>
    body{font-family:Arial,sans-serif;font-size:13px;padding:16px;max-width:400px}
    h1{font-size:20px;margin-bottom:4px}
    .header{border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:12px}
    .item{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #ccc}
    .total{display:flex;justify-content:space-between;font-weight:bold;font-size:16px;margin-top:8px;padding-top:8px;border-top:2px solid #000}
    .footer{text-align:center;margin-top:16px;font-size:11px;color:#666}
  </style></head><body>
    <div class="header">
      <h1>FACTURA</h1>
      <p>N°: <strong>${inv.number}</strong></p>
      <p>Fecha: ${inv.date || now}</p>
      ${inv.customer_name ? `<p>Cliente: ${inv.customer_name}</p>` : ''}
      ${inv.customer_tax_id ? `<p>CUIT/DNI: ${inv.customer_tax_id}</p>` : ''}
    </div>
    ${inv.items?.map(i => `<div class="item"><span>${i.quantity}x ${i.name}</span><span>$${(i.quantity * i.unit_price).toLocaleString('es-AR')}</span></div>`).join('') || ''}
    <div class="total"><span>TOTAL</span><span>$${Number(inv.total).toLocaleString('es-AR')}</span></div>
    <div class="footer">Gracias por su visita</div>
  </body></html>`;
}
