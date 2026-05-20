import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { stock, fmt } from '../lib/api';

export default function StockPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lowItems, setLowItems] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showMovModal, setShowMovModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({ name: '', unit: 'kg', current_quantity: '', min_quantity: '', cost_per_unit: '', category_id: '' });
  const [movForm, setMovForm] = useState({ type: 'in', quantity: '', notes: '' });

  const load = async () => {
    const [its, cats, low] = await Promise.all([stock.items(), stock.categories(), stock.lowItems()]);
    setItems(its);
    setCategories(cats);
    setLowItems(low);
    if (cats.length && !selectedCat) setSelectedCat('all');
  };

  useEffect(() => { load(); }, []);

  const filteredItems = selectedCat && selectedCat !== 'all'
    ? items.filter(i => i.category_id === parseInt(selectedCat))
    : items;

  const handleSaveItem = async () => {
    if (!itemForm.name) return toast.error('Nombre requerido');
    try {
      const data = {
        ...itemForm,
        current_quantity: parseFloat(itemForm.current_quantity) || 0,
        min_quantity: parseFloat(itemForm.min_quantity) || 0,
        cost_per_unit: parseFloat(itemForm.cost_per_unit) || 0,
        category_id: itemForm.category_id || null,
      };
      if (editingItem) await stock.updateItem(editingItem.id, data);
      else await stock.createItem(data);
      toast.success(editingItem ? 'Item actualizado' : 'Item creado');
      setShowItemModal(false);
      setEditingItem(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleMovement = async () => {
    if (!movForm.quantity) return toast.error('Cantidad requerida');
    try {
      await stock.addMovement(showMovModal.id, { ...movForm, quantity: parseFloat(movForm.quantity) });
      toast.success('Movimiento registrado');
      setShowMovModal(null);
      setMovForm({ type: 'in', quantity: '', notes: '' });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setItemForm({ name: item.name, unit: item.unit, current_quantity: item.current_quantity, min_quantity: item.min_quantity, cost_per_unit: item.cost_per_unit, category_id: item.category_id || '' });
    setShowItemModal(true);
  };

  const UNITS = ['kg', 'g', 'litro', 'ml', 'unidad', 'docena', 'caja', 'botella', 'bolsa', 'lata'];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-52 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Categorías</h2>
        </div>
        <div className="flex-1 p-2 space-y-1">
          <div onClick={() => setSelectedCat('all')} className={`px-3 py-2 rounded-lg cursor-pointer text-sm ${selectedCat === 'all' ? 'bg-amber-500 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
            Todos ({items.length})
          </div>
          {categories.map(cat => (
            <div key={cat.id} onClick={() => setSelectedCat(String(cat.id))} className={`px-3 py-2 rounded-lg cursor-pointer text-sm flex justify-between ${selectedCat === String(cat.id) ? 'bg-amber-500 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              <span>{cat.name}</span>
              <span className="text-xs opacity-75">{items.filter(i => i.category_id === cat.id).length}</span>
            </div>
          ))}
        </div>
        {lowItems.length > 0 && (
          <div className="p-3 bg-red-900/50 border-t border-red-800">
            <div className="flex items-center gap-2 text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{lowItems.length} con stock bajo</span>
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Stock</h1>
            <p className="text-sm text-gray-500">{filteredItems.length} items</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary btn-sm flex items-center gap-1"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => { setShowItemModal(true); setEditingItem(null); setItemForm({ name: '', unit: 'kg', current_quantity: '', min_quantity: '', cost_per_unit: '', category_id: '' }); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Agregar Item
            </button>
          </div>
        </div>

        {/* Low stock alert */}
        {lowItems.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Stock bajo: {lowItems.map(i => i.name).join(', ')}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-3">
            {filteredItems.map(item => {
              const isLow = item.current_quantity <= item.min_quantity;
              return (
                <div key={item.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${isLow ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {isLow && <span className="badge bg-red-100 text-red-600"><AlertTriangle className="w-3 h-3 inline mr-1" />Stock bajo</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{item.category_name} · Mín: {item.min_quantity} {item.unit} · Costo: {fmt.currency(item.cost_per_unit)}/{item.unit}</p>
                  </div>
                  <div className="text-center min-w-24">
                    <p className={`text-2xl font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{item.current_quantity}</p>
                    <p className="text-xs text-gray-400">{item.unit}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setShowMovModal(item); setMovForm({ type: 'in', quantity: '', notes: '' }); }} className="btn-success btn-sm flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Ingreso</button>
                    <button onClick={() => { setShowMovModal(item); setMovForm({ type: 'out', quantity: '', notes: '' }); }} className="btn-secondary btn-sm flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Egreso</button>
                    <button onClick={() => openEdit(item)} className="p-2 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-400" /></button>
                    <button onClick={async () => { await stock.deleteItem(item.id); load(); }} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && <p className="text-center text-gray-400 py-12">Sin items de stock</p>}
          </div>
        </div>
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingItem ? 'Editar Item' : 'Nuevo Item de Stock'}</h2>
              <button onClick={() => setShowItemModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nombre *</label><input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="Ej: Carne molida" autoFocus /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Unidad</label>
                  <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} className="input">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div><label className="label">Categoría</label>
                  <select value={itemForm.category_id} onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))} className="input">
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label">Stock actual</label><input type="number" value={itemForm.current_quantity} onChange={e => setItemForm(f => ({ ...f, current_quantity: e.target.value }))} className="input" placeholder="0" /></div>
                <div><label className="label">Stock mínimo</label><input type="number" value={itemForm.min_quantity} onChange={e => setItemForm(f => ({ ...f, min_quantity: e.target.value }))} className="input" placeholder="0" /></div>
                <div><label className="label">Costo/{itemForm.unit}</label><input type="number" value={itemForm.cost_per_unit} onChange={e => setItemForm(f => ({ ...f, cost_per_unit: e.target.value }))} className="input" placeholder="0" /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSaveItem} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Movimiento de Stock</h2>
              <button onClick={() => setShowMovModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Item: <strong>{showMovModal.name}</strong> | Stock actual: <strong>{showMovModal.current_quantity} {showMovModal.unit}</strong></p>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {['in', 'out', 'adjustment'].map(t => (
                  <button key={t} onClick={() => setMovForm(f => ({ ...f, type: t }))} className={`py-2 rounded-lg border-2 text-sm font-medium ${movForm.type === t ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200'}`}>
                    {t === 'in' ? 'Ingreso' : t === 'out' ? 'Egreso' : 'Ajuste'}
                  </button>
                ))}
              </div>
              <div><label className="label">Cantidad ({showMovModal.unit}) *</label>
                <input type="number" value={movForm.quantity} onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))} className="input" placeholder="0" autoFocus /></div>
              <div><label className="label">Notas</label><input value={movForm.notes} onChange={e => setMovForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Ej: Compra del 20/05" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMovModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleMovement} className="btn-primary flex-1">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
