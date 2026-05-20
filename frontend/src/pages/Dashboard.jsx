import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, ShoppingBag, Users, DollarSign, Calendar, BarChart3 } from 'lucide-react';
import { reports, fmt } from '../lib/api';

const today = () => new Date().toISOString().split('T')[0];
const thisMonth = () => new Date().toISOString().slice(0, 7);

const PAYMENT_COLORS = {
  efectivo: '#10b981',
  transferencia: '#3b82f6',
  tarjeta: '#8b5cf6',
  mixto: '#f59e0b',
};

function StatCard({ title, value, subtitle, icon: Icon, color = 'amber' }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [tab, setTab] = useState('daily');
  const [dailyData, setDailyData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedMonth, setSelectedMonth] = useState(thisMonth());

  useEffect(() => {
    if (tab === 'daily') loadDaily();
    else if (tab === 'weekly') loadWeekly();
    else if (tab === 'monthly') loadMonthly();
  }, [tab, selectedDate, selectedMonth]);

  const loadDaily = async () => {
    const data = await reports.daily(selectedDate);
    setDailyData(data);
  };

  const loadWeekly = async () => {
    const data = await reports.weekly();
    setWeeklyData(data);
  };

  const loadMonthly = async () => {
    const data = await reports.monthly(selectedMonth);
    setMonthlyData(data);
  };

  const TAB_LABELS = [
    { key: 'daily', label: 'Diario', icon: Calendar },
    { key: 'weekly', label: 'Semanal', icon: TrendingUp },
    { key: 'monthly', label: 'Mensual', icon: BarChart3 },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          {TAB_LABELS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`btn-sm btn flex items-center gap-1 ${tab === key ? 'btn-primary' : 'btn-secondary'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'daily' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input w-auto" />
          </div>
          {dailyData && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard title="Ingresos" value={fmt.currency(dailyData.sales.total_revenue)} icon={DollarSign} color="green" />
                <StatCard title="Comandas" value={dailyData.sales.orders_count} icon={ShoppingBag} color="blue" />
                <StatCard title="Ticket promedio" value={fmt.currency(dailyData.sales.avg_ticket)} icon={TrendingUp} color="purple" />
                <StatCard title="Fecha" value={fmt.date(selectedDate)} icon={Calendar} color="amber" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Hourly sales */}
                <div className="card">
                  <h3 className="font-bold mb-4">Ventas por hora</h3>
                  {dailyData.hourlySales.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailyData.hourlySales}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tickFormatter={h => `${h}hs`} />
                        <YAxis tickFormatter={v => fmt.currency(v)} width={70} />
                        <Tooltip formatter={v => fmt.currency(v)} labelFormatter={h => `${h}:00 hs`} />
                        <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-gray-400 text-sm py-8 text-center">Sin datos para esta fecha</p>}
                </div>

                {/* Payment methods */}
                <div className="card">
                  <h3 className="font-bold mb-4">Formas de pago</h3>
                  {dailyData.byPayment.length > 0 ? (
                    <div className="space-y-3">
                      {dailyData.byPayment.map(p => (
                        <div key={p.payment_method} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[p.payment_method] || '#999' }} />
                          <span className="text-sm capitalize flex-1">{p.payment_method || 'Sin método'}</span>
                          <span className="text-sm font-medium">{fmt.currency(p.total)}</span>
                          <span className="text-xs text-gray-400">({p.count})</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-gray-400 text-sm py-8 text-center">Sin datos</p>}
                </div>
              </div>

              {/* Top items */}
              <div className="card">
                <h3 className="font-bold mb-4">Productos más vendidos</h3>
                {dailyData.topItems.length > 0 ? (
                  <div className="space-y-2">
                    {dailyData.topItems.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-gray-500">{item.qty} und · {fmt.currency(item.revenue)}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${(item.qty / dailyData.topItems[0].qty) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-400 text-sm py-4 text-center">Sin datos</p>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'weekly' && weeklyData && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard title="Ingresos 7 días" value={fmt.currency(weeklyData.total.total_revenue)} icon={DollarSign} color="green" />
            <StatCard title="Comandas" value={weeklyData.total.orders_count} icon={ShoppingBag} color="blue" />
            <StatCard title="Promedio diario" value={fmt.currency(weeklyData.total.total_revenue / 7)} icon={TrendingUp} color="amber" />
          </div>

          <div className="card mb-6">
            <h3 className="font-bold mb-4">Ventas últimos 7 días</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyData.days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickFormatter={d => new Date(d + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })} />
                <YAxis tickFormatter={v => fmt.currency(v)} width={80} />
                <Tooltip formatter={v => fmt.currency(v)} labelFormatter={d => fmt.date(d)} />
                <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-bold mb-4">Top 10 productos (semana)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyData.topItems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => String(v)} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="qty" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Cantidad" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'monthly' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input w-auto" />
          </div>
          {monthlyData && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard title="Ingresos del mes" value={fmt.currency(monthlyData.total.total_revenue)} icon={DollarSign} color="green" />
                <StatCard title="Comandas" value={monthlyData.total.orders_count} icon={ShoppingBag} color="blue" />
                <StatCard title="Ticket promedio" value={fmt.currency(monthlyData.total.avg_ticket)} icon={TrendingUp} color="purple" />
                <StatCard title="Gastos proveedores" value={fmt.currency(monthlyData.supplierCosts.total)} icon={Users} color="amber" />
              </div>

              {/* Revenue evolution */}
              <div className="card mb-6">
                <h3 className="font-bold mb-4">Evolución diaria del mes</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickFormatter={d => new Date(d + 'T12:00').getDate()} />
                    <YAxis tickFormatter={v => fmt.currency(v)} width={80} />
                    <Tooltip formatter={v => fmt.currency(v)} labelFormatter={d => fmt.date(d)} />
                    <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Historical */}
                <div className="card">
                  <h3 className="font-bold mb-4">Historial (últimos 6 meses)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyData.monthlyHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={v => fmt.currency(v)} width={80} />
                      <Tooltip formatter={v => fmt.currency(v)} />
                      <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Payment methods */}
                <div className="card">
                  <h3 className="font-bold mb-4">Formas de pago del mes</h3>
                  {monthlyData.byPayment.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={monthlyData.byPayment.map(p => ({ name: p.payment_method || 'Sin método', value: p.total }))} dataKey="value" nameKey="name" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {monthlyData.byPayment.map((p, i) => (
                            <Cell key={i} fill={PAYMENT_COLORS[p.payment_method] || '#999'} />
                          ))}
                        </Pie>
                        <Tooltip formatter={v => fmt.currency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-gray-400 text-sm py-8 text-center">Sin datos</p>}
                </div>
              </div>

              {/* Caja chica summary */}
              <div className="card mb-6">
                <h3 className="font-bold mb-3">Resumen financiero del mes</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div><p className="text-sm text-gray-500">Ingresos ventas</p><p className="font-bold text-green-600 text-lg">{fmt.currency(monthlyData.total.total_revenue)}</p></div>
                  <div><p className="text-sm text-gray-500">Gastos proveedores</p><p className="font-bold text-red-600 text-lg">{fmt.currency(monthlyData.supplierCosts.total)}</p></div>
                  <div><p className="text-sm text-gray-500">Balance estimado</p><p className="font-bold text-blue-600 text-lg">{fmt.currency(monthlyData.total.total_revenue - monthlyData.supplierCosts.total)}</p></div>
                </div>
              </div>

              {/* Top items */}
              <div className="card">
                <h3 className="font-bold mb-4">Productos más vendidos del mes</h3>
                <div className="space-y-2">
                  {monthlyData.topItems.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-gray-500">{item.qty} und · {fmt.currency(item.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${(item.revenue / monthlyData.topItems[0].revenue) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
