import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, ChevronRight, Trash2, Edit2, DollarSign, Calendar, Check } from 'lucide-react';
import { suppliers, fmt } from '../lib/api';

const PAYMENT_METHODS_S = ['efectivo', 'transferencia', 'cheque', 'otro'];

export default function SuppliersPage() {
  const [supplierList, setSupplierList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [payments, setPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [tab, setTab] = useState('list');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', phone: '', email: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], description: '', payment_method: 'transferencia', notes: '' });

  const load = async () => {
    const data = await suppliers.list();
    setSupplierList(data);
    const payments = await suppliers.allPayments();
    setAllPayments(payments);
  };

  const loadPayments = async (supplierId) => {
    const data = await suppliers.payments(supplierId);
    setPayments(data);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedSupplier) loadPayments(selectedSupplier.id); }, [selectedSupplier]);

  const handleSaveSupplier = async () => {
    if (!supplierForm.name) return toast.error('Nombre requerido');
    try {
      if (editingSupplier) await suppliers.update(editingSupplier.id, supplierForm);
      else await suppliers.create(supplierForm);
      toast.success(editingSupplier ? 'Proveedor actualizado' : 'Proveedor creado');
      setShowSupplierModal(false);
      setEditingSupplier(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteSupplier = async (id) => {
    if (!confirm('¿Eliminar proveedor?')) return;
    await suppliers.delete(id);
    toast.success('Proveedor eliminado');
    if (selectedSupplier?.id === id) setSelectedSupplier(null);
    load();
  };

  const handleSavePayment = async () => {
    if (!paymentForm.amount) return toast.error('Monto requerido');
    try {
      if (editingPayment) await suppliers.updatePayment(editingPayment.id, paymentForm);
      else await suppliers.createPayment(selectedSupplier.id, paymentForm);
      toast.success(editingPayment ? 'Pago actualizado' : 'Pago registrado');
      setShowPaymentModal(false);
      setEditingPayment(null);
      setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], description: '', payment_method: 'transferencia', notes: '' });
      loadPayments(selectedSupplier.id);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDeletePayment = async (paymentId) => {
    await suppliers.deletePayment(paymentId);
    loadPayments(selectedSupplier.id);
    load();
  };

  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex h-screen">
      {/* Supplier list */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Proveedores</h2>
          <button onClick={() => { setShowSupplierModal(true); setEditingSupplier(null); setSupplierForm({ name: '', contact: '', phone: '', email: '', notes: '' }); }} className="p-1 hover:bg-gray-100 rounded">
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {supplierList.length === 0 && <p className="p-4 text-sm text-gray-400">Sin proveedores</p>}
          {supplierList.map(s => (
            <div key={s.id} onClick={() => setSelectedSupplier(s)} className={`px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 flex items-center gap-2 ${selectedSupplier?.id === s.id ? 'bg-amber-50 border-l-4 border-l-amber-500' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{s.name}</p>
                {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Total paid summary */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">Total pagado</p>
          <p className="font-bold text-gray-900">{fmt.currency(totalPaid)}</p>
        </div>
      </div>

      {/* Supplier detail */}
      <div className="flex-1 flex flex-col">
        {!selectedSupplier ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <DollarSign className="w-16 h-16 opacity-20 mb-4" />
            <p>Seleccioná un proveedor</p>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedSupplier.name}</h1>
                  {selectedSupplier.contact && <p className="text-sm text-gray-500">Contacto: {selectedSupplier.contact}</p>}
                  {selectedSupplier.phone && <p className="text-sm text-gray-500">Tel: {selectedSupplier.phone}</p>}
                  {selectedSupplier.email && <p className="text-sm text-gray-500">Email: {selectedSupplier.email}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingSupplier(selectedSupplier); setSupplierForm({ name: selectedSupplier.name, contact: selectedSupplier.contact || '', phone: selectedSupplier.phone || '', email: selectedSupplier.email || '', notes: selectedSupplier.notes || '' }); setShowSupplierModal(true); }} className="btn-secondary btn-sm flex items-center gap-1"><Edit2 className="w-3 h-3" /> Editar</button>
                  <button onClick={() => handleDeleteSupplier(selectedSupplier.id)} className="btn-danger btn-sm flex items-center gap-1"><Trash2 className="w-3 h-3" /> Eliminar</button>
                </div>
              </div>
              {selectedSupplier.notes && <p className="text-sm text-gray-400 mt-2 italic">{selectedSupplier.notes}</p>}
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900">Pagos</h2>
                  <p className="text-sm text-gray-500">Total: {fmt.currency(payments.reduce((s, p) => s + p.amount, 0))}</p>
                </div>
                <button onClick={() => { setShowPaymentModal(true); setEditingPayment(null); setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], description: '', payment_method: 'transferencia', notes: '' }); }} className="btn-primary flex items-center gap-2 btn-sm">
                  <Plus className="w-4 h-4" /> Registrar Pago
                </button>
              </div>

              <div className="space-y-3">
                {payments.length === 0 && <p className="text-center text-gray-400 py-8">Sin pagos registrados</p>}
                {payments.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{p.description || 'Pago'}</p>
                      <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                        <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{fmt.date(p.date)}</span>
                        <span className="capitalize badge bg-gray-100 text-gray-600">{p.payment_method}</span>
                      </div>
                      {p.notes && <p className="text-xs text-gray-400 italic">{p.notes}</p>}
                    </div>
                    <span className="font-bold text-green-600 text-lg">{fmt.currency(p.amount)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingPayment(p); setPaymentForm({ amount: p.amount, date: p.date, description: p.description || '', payment_method: p.payment_method, notes: p.notes || '' }); setShowPaymentModal(true); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 hover:bg-red-50 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <button onClick={() => setShowSupplierModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nombre *</label><input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="Nombre del proveedor" autoFocus /></div>
              <div><label className="label">Contacto</label><input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} className="input" placeholder="Nombre del contacto" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Teléfono</label><input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} className="input" placeholder="11-1234-5678" /></div>
                <div><label className="label">Email</label><input value={supplierForm.email} onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))} className="input" placeholder="mail@ejemplo.com" /></div>
              </div>
              <div><label className="label">Notas</label><textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} className="input" rows="2" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSupplierModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSaveSupplier} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingPayment ? 'Editar Pago' : 'Registrar Pago'}</h2>
              <button onClick={() => setShowPaymentModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Monto *</label><input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} className="input" placeholder="0" autoFocus /></div>
              <div><label className="label">Descripción</label><input value={paymentForm.description} onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="Ej: Factura #123" /></div>
              <div><label className="label">Fecha</label><input type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} className="input" /></div>
              <div>
                <label className="label">Forma de pago</label>
                <select value={paymentForm.payment_method} onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))} className="input">
                  {PAYMENT_METHODS_S.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
                </select>
              </div>
              <div><label className="label">Notas</label><input value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Notas adicionales..." /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSavePayment} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
