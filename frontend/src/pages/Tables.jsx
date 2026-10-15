import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Users, Utensils, X, Trash2, Move, Check, ArrowLeftRight, History } from 'lucide-react';
import { tables, orders } from '../lib/api';
import { useAuth } from '../lib/auth';
import TableHistory from '../components/TableHistory';

// ---- Plano de mesas ----
// El plano tiene un tamaño lógico fijo y se escala para entrar en la pantalla, así la
// distribución se ve igual en la PC, la tablet y el celular. Las posiciones se guardan
// en esas unidades lógicas (no en píxeles reales de cada pantalla).
const CANVAS_W = 1100;
const CANVAS_H = 640;
const TABLE_SIZE = 96;
const GAP = 16;
const PAD = 16;
const SNAP = 8; // al arrastrar, las mesas se alinean a una grilla de 8 para que queden prolijas
const MIN_SCALE = 0.55; // por debajo de esto el plano se desplaza en horizontal en lugar de achicarse más

const ZONES = [
  { id: 'salon', label: 'Salón' },
  { id: 'vereda', label: 'Vereda' },
];
const ZONE_LABEL = Object.fromEntries(ZONES.map(z => [z.id, z.label]));
const ZONE_STORAGE_KEY = 'comandas_zone';

// Primer lugar libre del plano (recorriendo filas de izquierda a derecha)
function findFreeSlot(taken) {
  const step = TABLE_SIZE + GAP;
  const cols = Math.floor((CANVAS_W - PAD) / step);
  const rows = Math.floor((CANVAS_H - PAD) / step);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = PAD + c * step;
      const y = PAD + r * step;
      const busy = taken.some(p => Math.abs(p.x - x) < TABLE_SIZE && Math.abs(p.y - y) < TABLE_SIZE);
      if (!busy) return { x, y };
    }
  }
  return { x: PAD, y: PAD };
}

// Posición de cada mesa de una zona. Las que todavía no tienen lugar guardado
// (mesas nuevas o de antes de existir el plano) se acomodan solas en lugares libres.
function buildPositions(list) {
  const result = {};
  const taken = [];
  const pending = [];
  list.forEach(t => {
    if (t.x == null || t.y == null) {
      pending.push(t);
    } else {
      result[t.id] = { x: t.x, y: t.y };
      taken.push(result[t.id]);
    }
  });
  pending.sort((a, b) => a.number - b.number).forEach(t => {
    const slot = findFreeSlot(taken);
    result[t.id] = slot;
    taken.push(slot);
  });
  return result;
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const snap = (v) => Math.round(v / SNAP) * SNAP;

function loadSavedZone() {
  try {
    return localStorage.getItem(ZONE_STORAGE_KEY) === 'vereda' ? 'vereda' : 'salon';
  } catch {
    return 'salon';
  }
}

export default function TablesPage() {
  const { isAdmin } = useAuth();
  const [tableList, setTableList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState(loadSavedZone);
  const [openTableModal, setOpenTableModal] = useState(null);
  const [personsCount, setPersonsCount] = useState(2);
  const [addTableModal, setAddTableModal] = useState(false);
  const [newTable, setNewTable] = useState({ number: '', name: '', capacity: 4, zone: 'salon' });
  const [deleteMode, setDeleteMode] = useState(false);
  const [historyTable, setHistoryTable] = useState(null);

  // Modo "ordenar mesas": los cambios quedan en un borrador hasta apretar Guardar
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null); // { [id]: { zone, x, y } }
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const dragRef = useRef(null);

  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(CANVAS_W);
  const scale = Math.min(1, Math.max(MIN_SCALE, wrapW / CANVAS_W));

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

  useEffect(() => {
    try { localStorage.setItem(ZONE_STORAGE_KEY, zone); } catch { /* sin almacenamiento: no pasa nada */ }
  }, [zone]);

  // Mide el ancho disponible para escalar el plano
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    setWrapW(el.clientWidth);
    const observer = new ResizeObserver(entries => setWrapW(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  // Mesas con su zona y posición efectivas (el borrador pisa lo guardado mientras se edita)
  const { effective, positions } = useMemo(() => {
    const eff = tableList.map(t => {
      const d = draft && draft[t.id];
      return { ...t, zone: d ? d.zone : t.zone, x: d ? d.x : t.layout_x, y: d ? d.y : t.layout_y };
    });
    const pos = {};
    ZONES.forEach(z => { pos[z.id] = buildPositions(eff.filter(t => t.zone === z.id)); });
    return { effective: eff, positions: pos };
  }, [tableList, draft]);

  const zoneTables = effective.filter(t => t.zone === zone);

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

  const openAddModal = () => {
    setNewTable({ number: '', name: '', capacity: 4, zone });
    setAddTableModal(true);
  };

  const handleAddTable = async () => {
    if (!newTable.number) return toast.error('Ingresá el número de mesa');
    try {
      await tables.create({
        number: parseInt(newTable.number),
        name: newTable.name || `Mesa ${newTable.number}`,
        capacity: parseInt(newTable.capacity) || 4,
        zone: newTable.zone,
      });
      setAddTableModal(false);
      setZone(newTable.zone);
      setNewTable({ number: '', name: '', capacity: 4, zone: newTable.zone });
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

  // ---- Ordenar mesas ----
  const startEdit = () => {
    // Se congelan las posiciones actuales (incluidas las acomodadas automáticamente)
    // para que al mover una mesa no se muevan las demás.
    const snapshot = {};
    effective.forEach(t => {
      const p = positions[t.zone][t.id];
      snapshot[t.id] = { zone: t.zone, x: p.x, y: p.y };
    });
    setDraft(snapshot);
    setDirty(false);
    setDeleteMode(false);
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (dirty && !window.confirm('¿Descartar los cambios en la distribución?')) return;
    setEditMode(false);
    setDraft(null);
    setDirty(false);
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      const payload = effective.map(t => {
        const p = positions[t.zone][t.id];
        return { id: t.id, zone: t.zone, layout_x: p.x, layout_y: p.y };
      });
      await tables.saveLayout(payload);
      toast.success('Distribución guardada');
      setEditMode(false);
      setDraft(null);
      setDirty(false);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const moveToOtherZone = (table) => {
    const target = table.zone === 'salon' ? 'vereda' : 'salon';
    const slot = findFreeSlot(Object.values(positions[target]));
    setDraft(prev => ({ ...prev, [table.id]: { zone: target, x: slot.x, y: slot.y } }));
    setDirty(true);
    toast.success(`${table.name} pasa a ${ZONE_LABEL[target]}`);
  };

  const handlePointerDown = (e, table) => {
    if (!editMode || e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = positions[table.zone][table.id];
    dragRef.current = { id: table.id, zone: table.zone, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y };
    setDraggingId(table.id);
  };

  const handlePointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    // El plano está escalado: el movimiento en pantalla se divide por la escala para obtener unidades del plano
    const x = clamp(snap(d.origX + (e.clientX - d.startX) / scale), 0, CANVAS_W - TABLE_SIZE);
    const y = clamp(snap(d.origY + (e.clientY - d.startY) / scale), 0, CANVAS_H - TABLE_SIZE);
    setDraft(prev => ({ ...prev, [d.id]: { zone: d.zone, x, y } }));
    setDirty(true);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setDraggingId(null);
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

  const zoneInfo = (zoneId) => {
    const list = effective.filter(t => t.zone === zoneId);
    return { total: list.length, occupied: list.filter(t => t.status === 'occupied').length };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
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
        <div className="flex items-center gap-2 flex-wrap">
          {editMode ? (
            <>
              <span className="text-sm text-gray-500 mr-1">Arrastrá las mesas para acomodarlas</span>
              <button onClick={cancelEdit} disabled={saving} className="btn-secondary flex items-center gap-2">
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button onClick={handleSaveLayout} disabled={saving} className="btn-primary flex items-center gap-2">
                <Check className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          ) : (
            <>
              {isAdmin && (
                <button onClick={startEdit} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <Move className="w-4 h-4" /> Ordenar mesas
                </button>
              )}
              <button
                onClick={() => setDeleteMode(d => !d)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${deleteMode ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                <Trash2 className="w-4 h-4" /> {deleteMode ? 'Cancelar' : 'Eliminar'}
              </button>
              <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Agregar mesa
              </button>
              <button onClick={load} className="btn-secondary flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Actualizar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Zonas */}
      <div className="flex gap-2 mb-4">
        {ZONES.map(z => {
          const info = zoneInfo(z.id);
          const active = zone === z.id;
          return (
            <button
              key={z.id}
              onClick={() => setZone(z.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
              {z.label}
              <span className={`text-xs font-medium ${active ? 'text-gray-300' : 'text-gray-400'}`}>{info.total}</span>
              {info.occupied > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 rounded-full px-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{info.occupied}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>
      ) : (
        <div ref={wrapRef} className="overflow-x-auto">
          <div
            className="relative bg-white border border-gray-200 rounded-xl overflow-hidden"
            style={{
              width: CANVAS_W * scale,
              height: CANVAS_H * scale,
              ...(editMode ? { backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)', backgroundSize: `${24 * scale}px ${24 * scale}px` } : {}),
            }}
          >
            <div
              className="absolute top-0 left-0"
              style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: '0 0' }}
            >
              {zoneTables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
                  No hay mesas en {ZONE_LABEL[zone] === 'Vereda' ? 'la vereda' : 'el salón'}
                </div>
              )}
              {zoneTables.map(table => {
                const pos = positions[zone][table.id];
                const dragging = draggingId === table.id;
                return (
                  <button
                    key={table.id}
                    onClick={(e) => {
                      if (editMode) return;
                      return deleteMode ? handleDeleteTable(e, table) : handleTableClick(table);
                    }}
                    onPointerDown={(e) => handlePointerDown(e, table)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{ left: pos.x, top: pos.y, width: TABLE_SIZE, height: TABLE_SIZE, touchAction: editMode ? 'none' : undefined }}
                    className={`absolute rounded-xl border-2 flex flex-col items-center justify-center p-1.5 transition-shadow shadow-sm ${
                      editMode
                        ? `select-none cursor-grab ring-2 ring-offset-1 ring-gray-300 ${dragging ? 'z-20 shadow-xl cursor-grabbing' : ''}`
                        : 'cursor-pointer hover:shadow-md active:scale-95'
                    } ${deleteMode && table.status !== 'occupied' ? 'ring-2 ring-red-400 ring-offset-1' : ''} ${getTableColor(table)}`}
                  >
                    {deleteMode && table.status !== 'occupied' && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                        <X className="w-3 h-3 text-white" />
                      </span>
                    )}
                    {!editMode && !deleteMode && (
                      <span
                        role="button"
                        aria-label={`Historial de ${table.name}`}
                        title="Ver historial de la mesa"
                        onClick={(e) => { e.stopPropagation(); setHistoryTable(table); }}
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/15 hover:bg-black/30 flex items-center justify-center cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                    {editMode && (
                      <span
                        role="button"
                        title={`Pasar a ${table.zone === 'salon' ? 'Vereda' : 'Salón'}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); moveToOtherZone(table); }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 hover:bg-gray-700 rounded-full flex items-center justify-center cursor-pointer shadow"
                      >
                        <ArrowLeftRight className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <span className="text-xl font-bold leading-none">{table.number}</span>
                    <span className="text-xs font-medium opacity-90 mt-1 leading-none truncate w-full text-center px-0.5">{table.name}</span>
                    {table.status === 'occupied' && (
                      <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-2 text-[11px] opacity-90">
                        <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{table.persons_count}</span>
                        {table.item_count > 0 && <span className="flex items-center gap-0.5"><Utensils className="w-3 h-3" />{table.item_count}</span>}
                      </div>
                    )}
                    {table.status === 'free' && (
                      <span className="text-[11px] opacity-75 mt-1 leading-none">{table.capacity} p.</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-green-500" /> Libre</div>
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-red-500" /> Ocupada</div>
        <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-yellow-400" /> Reservada</div>
      </div>

      {historyTable && <TableHistory table={historyTable} onClose={() => setHistoryTable(null)} />}

      {/* Modal: Add Table */}
      {addTableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Agregar mesa</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="label">Zona</label>
                <div className="flex gap-2 mt-1">
                  {ZONES.map(z => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setNewTable(t => ({ ...t, zone: z.id }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${newTable.zone === z.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>
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
              <button onClick={() => { setAddTableModal(false); setNewTable({ number: '', name: '', capacity: 4, zone }); }} className="btn-secondary flex-1">Cancelar</button>
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
