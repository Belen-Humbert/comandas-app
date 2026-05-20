import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Users, Clock, Utensils } from 'lucide-react';
import { tables, orders, fmt } from '../lib/api';

export default function TablesPage() {
  const [tableList, setTableList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTableModal, setOpenTableModal] = useState(null);
  const [personsCount, setPersonsCount] = useState(2);
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
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {tableList.map(table => (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-3 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 ${getTableColor(table)}`}
            >
              <span className="text-2xl font-bold">{table.number}</span>
              <span className="text-xs font-medium opacity-90 mt-1">{table.name}</span>
              {table.status === 'occupied' && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 text-xs opacity-90">
                  <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{table.persons_count}</span>
                  {table.item_count > 0 && <span className="flex items-center gap-0.5"><Utensils className="w-3 h-3" />{table.item_count}</span>}
                </div>
              )}
              {table.status === 'free' && (
                <span className="text-xs opacity-75 mt-1">{table.capacity} pers.</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 flex gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-green-500" /> Libre</div>
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-red-500" /> Ocupada</div>
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-yellow-400" /> Reservada</div>
      </div>

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
