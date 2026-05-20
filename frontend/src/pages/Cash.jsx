import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, TrendingUp, TrendingDown, Wallet, PiggyBank, Check, AlertCircle } from 'lucide-react';
import { cash, fmt } from '../lib/api';

export default function CashPage() {
  const [tab, setTab] = useState('register');
  const [register, setRegister] = useState(null);
  const [pettyList, setPettyList] = useState([]);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(null);
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [editingPetty, setEditingPetty] = useState(null);
  const [openForm, setOpenForm] = useState({ initial_amount: '', notes: '' });
  const [closeForm, setCloseForm] = useState({ final_amount: '', notes: '' });
  const [movForm, setMovForm] = useState({ type: 'out', amount: '', description: '' });
  const [pettyForm, setPettyForm] = useState({ type: 'out', amount: '', description: '', comments: '', date: new Date().toISOString().split('T')[0] });

  const load = async () => {
    const [reg, petty] = await Promise.all([cash.current(), cash.pettyList()]);
    setRegister(reg);
    setPettyList(petty);
  };

  useEffect(() => { load(); }, []);

  const handleOpenRegister = async () => {
    try {
      await cash.open({ initial_amount: parseFloat(openForm.initial_amount) || 0, notes: openForm.notes });
      toast.success('Caja abierta');
      setShowOpenModal(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleCloseRegister = async () => {
    try {
      const result = await cash.close(register.id, { final_amount: parseFloat(closeForm.final_amount), notes: closeForm.notes });
      toast.success(`Caja cerrada. Diferencia: ${fmt.currency(result.difference)}`);
      setShowCloseModal(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleMovement = async () => {
    try {
      await cash.addMovement(register.id, { type: movForm.type, amount: parseFloat(movForm.amount), description: movForm.description });
      toast.success('Movimiento registrado');
      setShowMovementModal(null);
      setMovForm({ type: 'out', amount: '', description: '' });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleSavePetty = async () => {
    try {
      const data = { ...pettyForm, amount: parseFloat(pettyForm.amount) };
      if (editingPetty) await cash.pettyUpdate(editingPetty.id, data);
      else await cash.pettyCreate(data);
      toast.success(editingPetty ? 'Actualizado' : 'Registrado');
      setShowPettyModal(false);
      setEditingPetty(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const totalIn = register?.movements?.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0) || 0;
  const totalOut = register?.movements?.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0) || 0;
  const salesTotal = register?.sales?.reduce((s, row) => s + row.total, 0) || 0;

  const pettyBalance = pettyList.reduce((s, p) => s + (p.type === 'in' ? p.amount : -p.amount), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Caja</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('register')} className={`btn-sm btn ${tab === 'register' ? 'btn-primary' : 'btn-secondary'}`}>
            <Wallet className="w-4 h-4 inline mr-1" />Arqueo
          </button>
          <button onClick={() => setTab('petty')} className={`btn-sm btn ${tab === 'petty' ? 'btn-primary' : 'btn-secondary'}`}>
            <PiggyBank className="w-4 h-4 inline mr-1" />Caja Chica
          </button>
        </div>
      </div>

      {tab === 'register' && (
        <div>
          {!register ? (
            <div className="card flex flex-col items-center py-12 gap-4">
              <Wallet className="w-16 h-16 text-gray-300" />
              <p className="text-gray-500 text-lg">No hay caja abierta</p>
              <button onClick={() => setShowOpenModal(true)} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Abrir Caja
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Summary cards */}
              <div className="lg:col-span-1 space-y-4">
                <div className="card">
                  <p className="text-sm text-gray-500">Apertura</p>
                  <p className="text-xs text-gray-400">{fmt.datetime(register.opened_at)}</p>
                  <p className="text-2xl font-bold mt-1">{fmt.currency(register.initial_amount)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500">Ingresos por ventas</p>
                  <p className="text-2xl font-bold text-green-600">{fmt.currency(salesTotal)}</p>
                  <div className="mt-2 space-y-1">
                    {register.sales?.map(s => (
                      <div key={s.payment_method} className="flex justify-between text-sm">
                        <span className="text-gray-500 capitalize">{s.payment_method || 'Sin método'}</span>
                        <span>{fmt.currency(s.total)} ({s.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500">Movimientos manuales</p>
                  <div className="flex gap-4 mt-1">
                    <div><p className="text-xs text-green-600">Entradas</p><p className="font-bold text-green-600">{fmt.currency(totalIn)}</p></div>
                    <div><p className="text-xs text-red-600">Salidas</p><p className="font-bold text-red-600">{fmt.currency(totalOut)}</p></div>
                  </div>
                </div>
                <div className="card bg-amber-50 border-amber-200">
                  <p className="text-sm text-amber-700">Efectivo esperado en caja</p>
                  <p className="text-3xl font-bold text-amber-700">{fmt.currency(register.initial_amount + totalIn - totalOut + (register.sales?.find(s => s.payment_method === 'efectivo')?.total || 0))}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowMovementModal('in')} className="btn-success flex-1 btn-sm flex items-center justify-center gap-1"><TrendingUp className="w-4 h-4" /> Entrada</button>
                  <button onClick={() => setShowMovementModal('out')} className="btn-danger flex-1 btn-sm flex items-center justify-center gap-1"><TrendingDown className="w-4 h-4" /> Salida</button>
                </div>
                <button onClick={() => setShowCloseModal(true)} className="btn-secondary w-full">Cerrar Caja</button>
              </div>

              {/* Movements list */}
              <div className="lg:col-span-2 card">
                <h2 className="font-bold mb-4">Movimientos del día</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {register.movements?.length === 0 && <p className="text-gray-400 text-sm">Sin movimientos manuales</p>}
                  {register.movements?.map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-50">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${m.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {m.type === 'in' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{m.description}</p>
                        <p className="text-xs text-gray-400">{fmt.datetime(m.created_at)}</p>
                      </div>
                      <span className={`font-bold ${m.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                        {m.type === 'in' ? '+' : '-'}{fmt.currency(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'petty' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card bg-green-50 border-green-200">
              <p className="text-sm text-green-700">Entradas</p>
              <p className="text-2xl font-bold text-green-700">{fmt.currency(pettyList.filter(p => p.type === 'in').reduce((s, p) => s + p.amount, 0))}</p>
            </div>
            <div className="card bg-red-50 border-red-200">
              <p className="text-sm text-red-700">Salidas</p>
              <p className="text-2xl font-bold text-red-700">{fmt.currency(pettyList.filter(p => p.type === 'out').reduce((s, p) => s + p.amount, 0))}</p>
            </div>
            <div className={`card ${pettyBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-sm ${pettyBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Balance</p>
              <p className={`text-2xl font-bold ${pettyBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt.currency(pettyBalance)}</p>
            </div>
          </div>

          <div className="flex justify-end mb-4">
            <button onClick={() => { setShowPettyModal(true); setEditingPetty(null); setPettyForm({ type: 'out', amount: '', description: '', comments: '', date: new Date().toISOString().split('T')[0] }); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Registrar Movimiento
            </button>
          </div>

          <div className="card">
            <div className="space-y-2">
              {pettyList.length === 0 && <p className="text-center text-gray-400 py-8">Sin movimientos registrados</p>}
              {pettyList.map(p => (
                <div key={p.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {p.type === 'in' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.description}</p>
                    {p.comments && <p className="text-xs text-gray-400 italic">{p.comments}</p>}
                    <p className="text-xs text-gray-400">{fmt.date(p.date)}</p>
                  </div>
                  <span className={`font-bold ${p.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                    {p.type === 'in' ? '+' : '-'}{fmt.currency(p.amount)}
                  </span>
                  <button onClick={() => { setEditingPetty(p); setPettyForm({ type: p.type, amount: p.amount, description: p.description, comments: p.comments || '', date: p.date }); setShowPettyModal(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                    ✏️
                  </button>
                  <button onClick={async () => { await cash.pettyDelete(p.id); load(); }} className="p-1 hover:bg-red-50 rounded text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Open Register Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Abrir Caja</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Monto inicial (efectivo en caja)</label>
                <input type="number" value={openForm.initial_amount} onChange={e => setOpenForm(f => ({ ...f, initial_amount: e.target.value }))} className="input" placeholder="0" autoFocus />
              </div>
              <div>
                <label className="label">Notas (opcional)</label>
                <textarea value={openForm.notes} onChange={e => setOpenForm(f => ({ ...f, notes: e.target.value }))} className="input" rows="2" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowOpenModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleOpenRegister} className="btn-primary flex-1">Abrir Caja</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseModal && register && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Cerrar Caja</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Monto real en caja (contado)</label>
                <input type="number" value={closeForm.final_amount} onChange={e => setCloseForm(f => ({ ...f, final_amount: e.target.value }))} className="input" placeholder="0" autoFocus />
              </div>
              <div>
                <label className="label">Notas / Observaciones</label>
                <textarea value={closeForm.notes} onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))} className="input" rows="2" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCloseModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCloseRegister} className="btn-danger flex-1">Cerrar Caja</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementModal && register && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{showMovementModal === 'in' ? 'Registrar Entrada' : 'Registrar Salida'}</h2>
              <button onClick={() => setShowMovementModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Monto</label>
                <input type="number" value={movForm.amount} onChange={e => setMovForm(f => ({ ...f, amount: e.target.value, type: showMovementModal }))} className="input" placeholder="0" autoFocus />
              </div>
              <div>
                <label className="label">Descripción *</label>
                <input value={movForm.description} onChange={e => setMovForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="Motivo del movimiento..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMovementModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleMovement} className={`flex-1 ${showMovementModal === 'in' ? 'btn-success' : 'btn-danger'}`}>Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Petty Cash Modal */}
      {showPettyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingPetty ? 'Editar' : 'Nuevo'} Movimiento</h2>
              <button onClick={() => setShowPettyModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPettyForm(f => ({ ...f, type: 'out' }))} className={`py-2 rounded-lg border-2 text-sm font-medium ${pettyForm.type === 'out' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}>Salida</button>
                <button onClick={() => setPettyForm(f => ({ ...f, type: 'in' }))} className={`py-2 rounded-lg border-2 text-sm font-medium ${pettyForm.type === 'in' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}>Entrada</button>
              </div>
              <div>
                <label className="label">Monto *</label>
                <input type="number" value={pettyForm.amount} onChange={e => setPettyForm(f => ({ ...f, amount: e.target.value }))} className="input" placeholder="0" autoFocus />
              </div>
              <div>
                <label className="label">Descripción *</label>
                <input value={pettyForm.description} onChange={e => setPettyForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="Ej: Compra de limones" />
              </div>
              <div>
                <label className="label">Comentarios / Observaciones</label>
                <textarea value={pettyForm.comments} onChange={e => setPettyForm(f => ({ ...f, comments: e.target.value }))} className="input" rows="2" placeholder="Notas adicionales..." />
              </div>
              <div>
                <label className="label">Fecha</label>
                <input type="date" value={pettyForm.date} onChange={e => setPettyForm(f => ({ ...f, date: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPettyModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSavePetty} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
