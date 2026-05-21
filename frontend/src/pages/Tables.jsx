import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Users, Utensils, X, Trash2 } from 'lucide-react';
import { tables, orders, fmt } from '../lib/api';

export default function TablesPage() {
  const [tableList, setTableList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTableModal, setOpenTableModal] = useState(null);
  const [personsCount, setPersonsCount] = useState(2);
  const [addTableModal, setAddTableModal] = useState(false);
  const [newTable, setNewTable] = useState({ number: '', name: '', capacity: 4 });
  const [deleteMode, setDeleteMode] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await tables.list();
      setTableList(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const handleTableClick = async (table) => {
    if (table.status === 'free') {
      setOpenTableModal(table);
      setPersonsCount(2);
    } else if (table.status === 'occupied' && table.current_order_id) {
      navigate(`/order/${table.current_order_id}`);
    }
  };

  const handleOpenTable = async () => {
    try {
      const result = await orders.create({ table_id: openTableModal.id, persons_count: personsCount });
      setOpenTableModal(null);
      navigate(`/order/${result.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleAddTable = async () => {
    if (!newTable.number) return toast.error('Ingresá el número de mesa');
    try {
      await tables.create({
        number: parseInt(newTable.number),
        name: newTable.name || `Mesa ${newTable.number}`,
        capacity: parseInt(newTable.capacity) || 4,
      });
      setAddTableModal(false);
      setNewTable({ number: '', name: '', capacity: 4 });
      toast.success('Mesa agregada');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDeleteTable = async (e, table) => {
    e.stopPropagation();
    if (table.status === 'occupied') return toast.error('No se puede eliminar una mesa ocupada');
    if (!window.confirm(`¿Eliminar ${table.name}?`)) return;
    try {
      await tables.delete(table.id);
      toast.success('Mesa eliminada');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const getTableColor = (table) => {
    if (table.status === 'occupied') return 'bg-red-500 hover:bg-red-600 border-red-600 text-white';
    if (table.status === 'reserved') return 'bg-yellow-400 hover:bg-yellow-500 border-yellow-500 text-white';
    return 'bg-green-500 hover:bg-green-600 border-green-600 text-white';
  };

  const stats = {
    free: tableList.filter(t => t.status === 'free').length,
    occupied: tableList.filter(t => t.status === 'occupied').length,
    reserved: tableList.filter(t => t.status === 'reserved').length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mesas</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {stats.free} libres</span>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {stats.occupied} ocupadas</span>
            {stats.reserved > 0 && (
              <><span className="mx-2">·</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> {stats.reserved} reservadas</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDeleteMode(d => !d)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${deleteMode ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            <Trash2 className="w-4 h-4" /> {deleteMode ? 'Cancelar' : 'Eliminar'}
          </button>
          <button onClick={() => setAddTableModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Agregar mesa
          </button>
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-3">
          {tableList.map(table => (
            <button
              key={table.id}
              onClick={(e) => deleteMode ? handleDeleteTable(e, table) : handleTableClick(table)}
              className={`relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-1.5 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 ${deleteMode && table.status !== 'occupied' ? 'ring-2 ring-red-400 ring-offset-1' : ''} ${getTableColor(table)}`}
            >
              {deleteMode && table.status !== 'occupied' && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center">
                  <X className="w-2.5 h-2.5 text-white" />
                </span>
              )}
              <span className="text-sm font-bold leading-none">{table.number}</span>
              <span className="text-[9px] font-medium opacity-90 mt-0.5 leading-none truncate w-full text-center px-0.5">{table.name}</span>
              {table.status === 'occupied' && (
                <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1 text-[9px] opacity-90">
                  <span className="flex items-center gap-0.5"><Users className="w-2 h-2" />{table.persons_count}</span>
                  {table.item_count > 0 && <span className="flex items-center gap-0.5"><Utensils className="w-2 h-2" />{table.item_count}</span>}
                </div>
              )}
              {table.status === 'free' && (
                <span className="text-[9px] opacity-75 mt-0.5 leading-none">{table.capacity} p.</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-green-500" /> Libre</div>
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-red-500" /> Ocupada</div>
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-yellow-400" /> Reservada</div>
      </div>

      {/* Modal: Add Table */}
      {addTableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Agregar mesa</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="label">Número *</label>
                <input
                  type="number"
                  className="input mt-1"
                  placeholder="Ej: 16"
                  value={newTable.number}
                  onChange={e => setNewTable(t => ({ ...t, number: e.target.value, name: t.name || `Mesa ${e.target.value}` }))}
                />
              </div>
              <div>
                <label className="label">Nombre</label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder={`Mesa ${newTable.number || ''}`}
                  value={newTable.name}
                  onChange={e => setNewTable(t => ({ ...t, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Capacidad (personas)</label>
                <input
                  type="number"
                  className="input mt-1"
                  min="1"
                  value={newTable.capacity}
                  onChange={e => setNewTable(t => ({ ...t, capacity: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setAddTableModal(false); setNewTable({ number: '', name: '', capacity: 4 }); }} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleAddTable} className="btn-primary flex-1">Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Open Table */}
      {openTableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Abrir {openTableModal.name}</h2>
            <div className="mb-6">
              <label className="label">¿Cuántas personas?</label>
              <div className="flex items-center gap-4 mt-2">
                <button onClick={() => setPersonsCount(p => Math.max(1, p - 1))} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl font-bold">-</button>
                <span className="text-3xl font-bold w-12 text-center">{personsCount}</span>
                <button onClick={() => setPersonsCount(p => p + 1)} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl font-bold">+</button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setOpenTableModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleOpenTable} className="btn-primary flex-1">Abrir mesa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
