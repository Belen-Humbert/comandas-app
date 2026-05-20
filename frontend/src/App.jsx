import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  LayoutGrid, UtensilsCrossed, BookOpen, Calendar,
  Wallet, Truck, Package, BarChart3, ChevronRight
} from 'lucide-react';

import TablesPage from './pages/Tables';
import OrderPage from './pages/Order';
import MenuPage from './pages/Menu';
import ReservationsPage from './pages/Reservations';
import CashPage from './pages/Cash';
import SuppliersPage from './pages/Suppliers';
import StockPage from './pages/Stock';
import DashboardPage from './pages/Dashboard';

const NAV_ITEMS = [
  { to: '/', label: 'Mesas', icon: LayoutGrid, exact: true },
  { to: '/menu', label: 'Menú', icon: BookOpen },
  { to: '/reservations', label: 'Reservas', icon: Calendar },
  { to: '/cash', label: 'Caja', icon: Wallet },
  { to: '/suppliers', label: 'Proveedores', icon: Truck },
  { to: '/stock', label: 'Stock', icon: Package },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
];

export default function App() {
  const location = useLocation();
  const isOrderPage = location.pathname.startsWith('/order/');

  return (
    <div className="min-h-screen flex">
      {!isOrderPage && (
        <aside className="w-56 bg-gray-900 text-white flex flex-col fixed inset-y-0 left-0 z-30">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-amber-400" />
              <span className="font-bold text-lg">Comandas</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Sistema de gestión</p>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
            v1.0.0
          </div>
        </aside>
      )}

      <main className={`flex-1 ${!isOrderPage ? 'ml-56' : ''} min-h-screen`}>
        <Routes>
          <Route path="/" element={<TablesPage />} />
          <Route path="/order/:id" element={<OrderPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/cash" element={<CashPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          success: { duration: 2500 },
          error: { duration: 4000 },
        }}
      />
    </div>
  );
}
