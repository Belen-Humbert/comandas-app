import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, Calendar, Clock, Users, Phone, Trash2, Edit2, Check } from 'lucide-react';
import { reservations, tables, fmt } from '../lib/api';

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-700' },
  arrived: { label: 'Llegó', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

const today = () => new Date().toISOString().split('T')[0];

export default function ReservationsPage() {
  const [reservationList, setReservationList] = useState([]);
  const [tableList, setTableList] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ customer_name: '', phone: '', persons_count: 2, datetime: '', table_id: '', notes: '' });

  const load = async () => {
    const [res, tabs] = await Promise.all([reservations.list({ date: selectedDate }), tables.list()]);
    setReservationList(res);
    setTableList(tabs);
  };

  useEffect(() => { load(); }, [selectedDate]);

  const openNew = () => {
    setEditing(null);
    setForm({ customer_name: '', phone: '', persons_count: 2, datetime: `${selectedDate}T20:00`, table_id: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({ customer_name: r.customer_name, phone: r.phone || '', persons_count: r.persons_count, datetime: r.datetime.slice(0, 16), table_id: r.table_id || '', notes: r.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.customer_name || !form.datetime) return toast.error('Nombre y fecha/hora requeridos');
    try {
      if (editing) await reservations.update(editing.id, { ...form, status: editing.status });
      else await reservations.create(form);
      toast.success(editing ? 'Reserva actualizada' : 'Reserva creada');
      setShowModal(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleStatus = async (r, status) => {
    await reservations.update(r.id, { ...r, status });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar reserva?')) return;
    await reservations.delete(id);
    toast.success('Reserva eliminada');
    load();
  };

  const statusOrder = ['pending', 'confirmed', 'arrived', 'cancelled'];
  const sorted = [...reservationList].sort((a, b) => {
    const so = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    if (so !== 0) return so;
    return a.datetime.localeCompare(b.datetime);
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reservas</h1>
          <p className="text-sm text-gray-500">{reservationList.length} reservas para el día seleccionado</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input w-auto" />
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva Reserva
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {sorted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay reservas para esta fecha</p>
          </div>
        )}
        {sorted.map(r => (
          <div key={r.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${r.status === 'cancelled' ? 'opacity-50' : 'border-gray-100'}`}>
            <div className="text-center min-w-16">
              <p className="text-xl font-bold text-gray-900">{new Date(r.datetime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-xs text-gray-400">{new Date(r.datetime).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{r.customer_name}</p>
                <span className={`badge ${STATUS_CONFIG[r.status]?.color}`}>{STATUS_CONFIG[r.status]?.label}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {r.persons_count} personas</span>
                {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.phone}</span>}
                {r.table_name && <span>Mesa {r.table_number}</span>}
              </div>
              {r.notes && <p className="text-sm text-gray-400 mt-1 italic">{r.notes}</p>}
            </div>
            <div className="flex items-center gap-1">
              {r.status === 'pending' && <button onClick={() => handleStatus(r, 'confirmed')} className="btn-secondary btn-sm">Confirmar</button>}
              {r.status === 'confirmed' && <button onClick={() => handleStatus(r, 'arrived')} className="btn-success btn-sm">Llegó</button>}
              <button onClick={() => openEdit(r)} className="p-2 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => handleDelete(r.id)} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? 'Editar Reserva' : 'Nueva Reserva'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre del cliente *</label>
                <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className="input" placeholder="Nombre..." autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Teléfono</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input" placeholder="11-1234-5678" />
                </div>
                <div>
                  <label className="label">Personas</label>
                  <input type="number" min="1" value={form.persons_count} onChange={e => setForm(f => ({ ...f, persons_count: parseInt(e.target.value) }))} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Fecha y hora *</label>
                <input type="datetime-local" value={form.datetime} onChange={e => setForm(f => ({ ...f, datetime: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Mesa (opcional)</label>
                <select value={form.table_id} onChange={e => setForm(f => ({ ...f, table_id: e.target.value }))} className="input">
                  <option value="">Sin asignar</option>
                  {tableList.filter(t => t.status === 'free').map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.capacity} pers.)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" rows="2" placeholder="Observaciones..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
