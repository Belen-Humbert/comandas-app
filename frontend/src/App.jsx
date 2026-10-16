import React from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  LayoutGrid, UtensilsCrossed, BookOpen, Calendar,
  Wallet, Truck, Package, BarChart3, Users, LogOut, Bike
} from 'lucide-react';

import { useAuth } from './lib/auth';
import LoginPage from './pages/Login';
import TablesPage from './pages/Tables';
import OrderPage from './pages/Order';
import MenuPage from './pages/Menu';
import ReservationsPage from './pages/Reservations';
import CashPage from './pages/Cash';
import SuppliersPage from './pages/Suppliers';
import StockPage from './pages/Stock';
import DashboardPage from './pages/Dashboard';
import UsersPage from './pages/Users';
import DeliveryPage from './pages/Delivery';

// adminOnly: coincide con las rutas que el backend restringe al rol 'admin'
const NAV_ITEMS = [
  { to: '/', label: 'Mesas', icon: LayoutGrid, exact: true },
  { to: '/delivery', label: 'Delivery', icon: Bike },
  { to: '/menu', label: 'Menú', icon: BookOpen },
  { to: '/reservations', label: 'Reservas', icon: Calendar },
  { to: '/cash', label: 'Caja', icon: Wallet },
  { to: '/suppliers', label: 'Proveedores', icon: Truck, adminOnly: true },
  { to: '/stock', label: 'Stock', icon: Package, adminOnly: true },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3, adminOnly: true },
  { to: '/users', label: 'Personal', icon: Users, adminOnly: true },
];

const ROLE_LABELS = { admin: 'Administrador', salon: 'Salón' };

function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

const toaster = (
  <Toaster
    position="top-right"
    toastOptions={{
      success: { duration: 2500 },
      error: { duration: 4000 },
    }}
  />
);

export default function App() {
  const location = useLocation();
  const { user, loading, logout, isAdmin } = useAuth();
  const isOrderPage = location.pathname.startsWith('/order/');

  // Verificando si el token guardado sigue siendo válido
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <UtensilsCrossed className="w-10 h-10 text-amber-400 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        {toaster}
      </>
    );
  }

  const navItems = NAV_ITEMS.filter(item => isAdmin || !item.adminOnly);

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
            {navItems.map(({ to, label, icon: Icon, exact }) => (
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
          <div className="p-4 border-t border-gray-700">
            <p className="text-sm font-medium truncate">{user.full_name || user.username}</p>
            <p className="text-xs text-gray-400 mb-3">{ROLE_LABELS[user.role] || user.role}</p>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
            </button>
          </div>
        </aside>
      )}

      <main className={`flex-1 ${!isOrderPage ? 'ml-56' : ''} min-h-screen`}>
        <Routes>
          <Route path="/" element={<TablesPage />} />
          <Route path="/order/:id" element={<OrderPage />} />
          <Route path="/delivery" element={<DeliveryPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/cash" element={<CashPage />} />
          <Route path="/suppliers" element={<AdminRoute><SuppliersPage /></AdminRoute>} />
          <Route path="/stock" element={<AdminRoute><StockPage /></AdminRoute>} />
          <Route path="/dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />
          <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {toaster}
    </div>
  );
}
