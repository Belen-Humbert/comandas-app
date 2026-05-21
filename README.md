# Comandas — Sistema de Gestión de Restaurant

Sistema web para la gestión operativa de un restaurant: mesas, pedidos, menú, reservas, caja, proveedores y stock. Funciona en red local, permitiendo usarlo desde múltiples dispositivos (PC, tablet, celular) sin conexión a internet.

---

## Tecnologías

| Capa | Stack |
|------|-------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Recharts |
| Backend | Node.js, Express, SQLite (better-sqlite3) |
| Base de datos | SQLite — archivo local `backend/data/comandas.db` |

---

## Requisitos

- **Node.js 18** o superior

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Belen-Humbert/comandas-app.git
cd comandas-app

# 2. Instalar dependencias del backend
cd backend
npm install

# 3. Instalar dependencias del frontend
cd ../frontend
npm install
```

---

## Correr en desarrollo

Necesitás **dos terminales** abiertas al mismo tiempo:

**Terminal 1 — Backend:**
```bash
cd backend
npm start
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

El frontend queda disponible en `http://localhost:5173` y el backend en `http://localhost:3001`.

---

## Usar desde otro dispositivo en la misma red

Al iniciar el backend, la consola muestra la IP de la red local:

```
🍽️  Comandas App - Backend corriendo
   Local:   http://localhost:3001
   Red:     http://192.168.1.100:3001
```

Para acceder desde otra PC, tablet o celular en la misma red WiFi, primero hay que hacer el build del frontend:

```bash
# Build del frontend
cd frontend
npm run build

# Iniciar solo el backend (también sirve el frontend)
cd ../backend
npm start
```

Luego acceder desde cualquier dispositivo a `http://192.168.1.100:3001` (usando la IP que aparece en la consola).

---

## Funcionalidades

### Mesas
- Vista en grilla con estado visual: **verde** (libre), **rojo** (ocupada), **amarillo** (reservada)
- Click en mesa libre → abre mesa indicando cantidad de personas
- Click en mesa ocupada → va directo a la comanda activa
- Agregar y eliminar mesas (protección: no permite eliminar mesas ocupadas)

### Comandas (Pedidos)
- Carga de ítems del menú por mesa
- Vista de items agrupados por persona
- Impresión de comanda para cocina
- Cobro individual por persona o total de la mesa

### Menú
- Gestión de categorías e ítems
- Precio, descripción y disponibilidad por ítem

### Reservas
- Registro de reservas con nombre del cliente, cantidad de personas y horario
- Vista de reservas del día

### Caja
- Arqueo de caja con apertura y cierre
- Caja chica: registro de entradas y salidas con observaciones
- Historial de movimientos

### Proveedores
- Registro de proveedores con datos de contacto
- Registro de pagos por proveedor

### Stock
- Control de mercadería con cantidad actual y stock mínimo
- Alertas visuales de stock bajo
- Registro de movimientos de entrada y salida

### Dashboard
- Resumen de ventas diarias, semanales y mensuales
- Gráficos de ingresos y productos más vendidos

---

## Base de datos

Los datos se guardan en `backend/data/comandas.db` (SQLite).

> Hacer backup de ese archivo regularmente para no perder la información.

---

## Estructura del proyecto

```
comandas-app/
├── backend/
│   ├── src/
│   │   ├── index.js          # Servidor Express
│   │   ├── db/database.js    # Conexión y esquema SQLite
│   │   └── routes/           # Endpoints por módulo
│   └── data/comandas.db      # Base de datos (se crea automáticamente)
└── frontend/
    └── src/
        ├── App.jsx
        ├── pages/            # Una página por módulo
        └── lib/api.js        # Cliente HTTP hacia el backend
```
