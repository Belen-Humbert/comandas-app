import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'Error de conexión';
    return Promise.reject(new Error(msg));
  }
);

export const tables = {
  list: () => api.get('/tables'),
  get: (id) => api.get(`/tables/${id}`),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  delete: (id) => api.delete(`/tables/${id}`),
};

export const menu = {
  categories: () => api.get('/menu/categories'),
  items: () => api.get('/menu/items'),
  search: (q) => api.get(`/menu/items/search?q=${encodeURIComponent(q)}`),
  createCategory: (data) => api.post('/menu/categories', data),
  updateCategory: (id, data) => api.put(`/menu/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/menu/categories/${id}`),
  createItem: (data) => api.post('/menu/items', data),
  updateItem: (id, data) => api.put(`/menu/items/${id}`, data),
  deleteItem: (id) => api.delete(`/menu/items/${id}`),
};

export const orders = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  addItems: (id, items) => api.post(`/orders/${id}/items`, items),
  updateItem: (orderId, itemId, data) => api.put(`/orders/${orderId}/items/${itemId}`, data),
  deleteItem: (orderId, itemId) => api.delete(`/orders/${orderId}/items/${itemId}`),
  close: (id, data) => api.post(`/orders/${id}/close`, data),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
  print: (id) => api.post(`/orders/${id}/print`),
};

export const invoices = {
  list: (params) => api.get('/invoices', { params }),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
};

export const reservations = {
  list: (params) => api.get('/reservations', { params }),
  create: (data) => api.post('/reservations', data),
  update: (id, data) => api.put(`/reservations/${id}`, data),
  delete: (id) => api.delete(`/reservations/${id}`),
};

export const cash = {
  registers: () => api.get('/cash/registers'),
  current: () => api.get('/cash/registers/current'),
  open: (data) => api.post('/cash/registers/open', data),
  close: (id, data) => api.post(`/cash/registers/${id}/close`, data),
  addMovement: (id, data) => api.post(`/cash/registers/${id}/movements`, data),
  pettyList: (params) => api.get('/cash/petty', { params }),
  pettyCreate: (data) => api.post('/cash/petty', data),
  pettyUpdate: (id, data) => api.put(`/cash/petty/${id}`, data),
  pettyDelete: (id) => api.delete(`/cash/petty/${id}`),
};

export const suppliers = {
  list: () => api.get('/suppliers'),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
  payments: (id) => api.get(`/suppliers/${id}/payments`),
  allPayments: (params) => api.get('/suppliers/payments/all', { params }),
  createPayment: (id, data) => api.post(`/suppliers/${id}/payments`, data),
  updatePayment: (id, data) => api.put(`/suppliers/payments/${id}`, data),
  deletePayment: (id) => api.delete(`/suppliers/payments/${id}`),
};

export const stock = {
  categories: () => api.get('/stock/categories'),
  items: () => api.get('/stock/items'),
  lowItems: () => api.get('/stock/items/low'),
  createItem: (data) => api.post('/stock/items', data),
  updateItem: (id, data) => api.put(`/stock/items/${id}`, data),
  deleteItem: (id) => api.delete(`/stock/items/${id}`),
  movements: (id) => api.get(`/stock/items/${id}/movements`),
  addMovement: (id, data) => api.post(`/stock/items/${id}/movements`, data),
};

export const reports = {
  daily: (date) => api.get('/reports/daily', { params: { date } }),
  weekly: () => api.get('/reports/weekly'),
  monthly: (month) => api.get('/reports/monthly', { params: { month } }),
};

export const fmt = {
  currency: (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  date: (d) => d ? new Date(d).toLocaleDateString('es-AR') : '-',
  datetime: (d) => d ? new Date(d).toLocaleString('es-AR') : '-',
  time: (d) => d ? new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-',
};
