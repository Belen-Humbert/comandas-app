import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Check, ToggleLeft, ToggleRight, ClipboardList } from 'lucide-react';
import { menu, stock, recipes, fmt } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function MenuPage() {
  // El backend solo deja editar el menú al admin; al personal de salón se le oculta la edición
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', category_id: '', available: true });
  const [catForm, setCatForm] = useState({ name: '', color: '#6366f1', kind: 'comida' });

  // Receta del plato seleccionado (insumos de stock que se descuentan al venderlo)
  const [recipeItem, setRecipeItem] = useState(null);
  const [recipeLines, setRecipeLines] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [recipeForm, setRecipeForm] = useState({ stock_item_id: '', quantity: '' });

  const load = async () => {
    const [cats, its] = await Promise.all([menu.categories(), menu.items()]);
    setCategories(cats);
    setItems(its);
    if (cats.length && !selectedCat) setSelectedCat(cats[0].id);
  };

  useEffect(() => { load(); }, []);

  const filteredItems = selectedCat ? items.filter(i => i.category_id === selectedCat) : items;

  const handleSaveItem = async () => {
    try {
      const data = { ...itemForm, price: parseFloat(itemForm.price), category_id: parseInt(itemForm.category_id || selectedCat) };
      if (editingItem) await menu.updateItem(editingItem.id, data);
      else await menu.createItem(data);
      toast.success(editingItem ? 'Item actualizado' : 'Item creado');
      setEditingItem(null);
      setShowNewItem(false);
      setItemForm({ name: '', description: '', price: '', category_id: '', available: true });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('¿Eliminar este item?')) return;
    await menu.deleteItem(id);
    toast.success('Item eliminado');
    load();
  };

  const handleToggleAvailable = async (item) => {
    await menu.updateItem(item.id, { ...item, available: !item.available });
    load();
  };

  const loadRecipe = async (menuItemId) => {
    setRecipeLines(await recipes.get(menuItemId));
  };

  const openRecipe = async (item) => {
    try {
      setRecipeItem(item);
      setRecipeForm({ stock_item_id: '', quantity: '' });
      const [lines, stockList] = await Promise.all([recipes.get(item.id), stock.items()]);
      setRecipeLines(lines);
      setStockItems(stockList);
    } catch (e) { toast.error(e.message); setRecipeItem(null); }
  };

  const closeRecipe = () => { setRecipeItem(null); setRecipeLines([]); };

  const handleAddIngredient = async () => {
    const quantity = parseFloat(String(recipeForm.quantity).replace(',', '.'));
    if (!recipeForm.stock_item_id) return toast.error('Elegí un insumo');
    if (!(quantity > 0)) return toast.error('La cantidad debe ser mayor a 0');
    try {
      await recipes.add({
        menu_item_id: recipeItem.id,
        stock_item_id: parseInt(recipeForm.stock_item_id),
        quantity_per_unit: quantity,
      });
      setRecipeForm({ stock_item_id: '', quantity: '' });
      await loadRecipe(recipeItem.id);
    } catch (e) { toast.error(e.message); }
  };

  const handleUpdateIngredient = async (line, value) => {
    const quantity = parseFloat(String(value).replace(',', '.'));
    if (!(quantity > 0)) { toast.error('La cantidad debe ser mayor a 0'); return loadRecipe(recipeItem.id); }
    if (quantity === line.quantity_per_unit) return;
    try {
      await recipes.update(line.id, { quantity_per_unit: quantity });
      toast.success('Cantidad actualizada');
      await loadRecipe(recipeItem.id);
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteIngredient = async (id) => {
    try {
      await recipes.remove(id);
      await loadRecipe(recipeItem.id);
    } catch (e) { toast.error(e.message); }
  };

  const handleSaveCat = async () => {
    try {
      if (editingCat) await menu.updateCategory(editingCat.id, catForm);
      else await menu.createCategory(catForm);
      toast.success(editingCat ? 'Categoría actualizada' : 'Categoría creada');
      setEditingCat(null);
      setShowNewCat(false);
      setCatForm({ name: '', color: '#6366f1', kind: 'comida' });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setItemForm({ name: item.name, description: item.description || '', price: item.price, category_id: item.category_id, available: item.available });
    setShowNewItem(true);
  };

  const COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#ec4899'];

  return (
    <div className="flex h-screen">
      {/* Sidebar: categories */}
      <div className="w-52 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Categorías</h2>
          {isAdmin && (
            <button onClick={() => { setShowNewCat(true); setEditingCat(null); setCatForm({ name: '', color: '#6366f1', kind: 'comida' }); }} className="p-1 hover:bg-gray-700 rounded">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {categories.map(cat => (
            <div key={cat.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group ${selectedCat === cat.id ? 'bg-amber-500' : 'hover:bg-gray-800'}`} onClick={() => setSelectedCat(cat.id)}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-sm flex-1 truncate">{cat.name}</span>
              {cat.kind === 'bebida' && <span className="text-[10px] uppercase tracking-wide opacity-60">bebida</span>}
              {isAdmin && (
                <button onClick={e => { e.stopPropagation(); setEditingCat(cat); setCatForm({ name: cat.name, color: cat.color, kind: cat.kind || 'comida' }); setShowNewCat(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-700 rounded">
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main: items */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Menú</h1>
            <p className="text-sm text-gray-500">{filteredItems.length} items en {categories.find(c => c.id === selectedCat)?.name || 'todas las categorías'}</p>
          </div>
          {isAdmin && (
            <button onClick={() => { setShowNewItem(true); setEditingItem(null); setItemForm({ name: '', description: '', price: '', category_id: selectedCat, available: true }); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Agregar Item
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-3">
            {filteredItems.map(item => (
              <div key={item.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${!item.available ? 'opacity-50' : 'border-gray-100'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {!item.available && <span className="badge bg-gray-100 text-gray-500">No disponible</span>}
                  </div>
                  {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                </div>
                <span className="font-bold text-amber-600 text-lg">{fmt.currency(item.price)}</span>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openRecipe(item)} className="p-2 hover:bg-amber-50 rounded-lg text-amber-600" title="Receta (insumos de stock)"><ClipboardList className="w-4 h-4" /></button>
                    <button onClick={() => handleToggleAvailable(item)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title={item.available ? 'Deshabilitar' : 'Habilitar'}>
                      {item.available ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => openEdit(item)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ))}
            {filteredItems.length === 0 && <p className="text-center text-gray-400 py-12">No hay items en esta categoría</p>}
          </div>
        </div>
      </div>

      {/* Modal: Item */}
      {showNewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingItem ? 'Editar Item' : 'Nuevo Item'}</h2>
              <button onClick={() => setShowNewItem(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="Ej: Milanesa napolitana" autoFocus />
              </div>
              <div>
                <label className="label">Descripción</label>
                <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="Descripción opcional..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Precio *</label>
                  <input value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} type="number" className="input" placeholder="0" />
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select value={itemForm.category_id} onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))} className="input">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="available" checked={itemForm.available} onChange={e => setItemForm(f => ({ ...f, available: e.target.checked }))} className="w-4 h-4" />
                <label htmlFor="available" className="text-sm font-medium text-gray-700">Disponible</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewItem(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSaveItem} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Receta (insumos de stock del plato) */}
      {recipeItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold truncate">Receta: {recipeItem.name}</h2>
              <button onClick={closeRecipe}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Insumos que se descuentan del stock por cada unidad vendida.</p>

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {recipeLines.map(line => (
                <div key={`${line.id}-${line.quantity_per_unit}`} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm font-medium truncate">{line.stock_item_name}</span>
                  <input
                    type="number" step="any" min="0"
                    defaultValue={line.quantity_per_unit}
                    onBlur={e => handleUpdateIngredient(line, e.target.value)}
                    className="input w-24 text-right"
                    aria-label={`Cantidad de ${line.stock_item_name}`}
                  />
                  <span className="text-xs text-gray-500 w-14 truncate">{line.unit}</span>
                  <button onClick={() => handleDeleteIngredient(line.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Quitar insumo"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {recipeLines.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">Sin insumos cargados: vender este item no descuenta stock.</p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="label">Agregar insumo</label>
              <div className="flex gap-2">
                <select value={recipeForm.stock_item_id} onChange={e => setRecipeForm(f => ({ ...f, stock_item_id: e.target.value }))} className="input flex-1">
                  <option value="">Elegir insumo...</option>
                  {stockItems
                    .filter(si => !recipeLines.some(l => l.stock_item_id === si.id))
                    .map(si => <option key={si.id} value={si.id}>{si.name} ({si.unit})</option>)}
                </select>
                <input
                  type="number" step="any" min="0"
                  value={recipeForm.quantity}
                  onChange={e => setRecipeForm(f => ({ ...f, quantity: e.target.value }))}
                  className="input w-24 text-right" placeholder="Cant."
                  aria-label="Cantidad por unidad vendida"
                />
                <button onClick={handleAddIngredient} className="btn-primary"><Plus className="w-4 h-4" /></button>
              </div>
              {stockItems.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">Todavía no hay insumos en Stock. Cargalos primero en la sección Stock.</p>
              )}
            </div>

            <button onClick={closeRecipe} className="btn-secondary w-full mt-5">Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal: Category */}
      {showNewCat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingCat ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
              <button onClick={() => setShowNewCat(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="Ej: Bebidas" autoFocus />
              </div>
              <div>
                <label className="label">Tipo (para las estadísticas)</label>
                <select value={catForm.kind} onChange={e => setCatForm(f => ({ ...f, kind: e.target.value }))} className="input" aria-label="Tipo de categoría">
                  <option value="comida">Comida (platos, postres, etc.)</option>
                  <option value="bebida">Bebida</option>
                </select>
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setCatForm(f => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full border-4 ${catForm.color === c ? 'border-gray-800' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewCat(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSaveCat} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}