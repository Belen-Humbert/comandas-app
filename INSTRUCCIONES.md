# Comandas App - Sistema de Gestión de Restaurant

## Instalación y arranque

### Requisitos
- Node.js 18 o superior instalado en la PC

### Primera vez
```bash
# Instalar dependencias
cd backend && npm install
cd ../frontend && npm install
```

### Arrancar el sistema
```bash
# Terminal 1: Backend (servidor)
cd backend
npm start

# Terminal 2: Frontend (en desarrollo)
cd frontend
npm run dev
```

El backend muestra en la consola la IP de la red local, por ejemplo:
```
🍽️  Comandas App - Backend corriendo
   Local:   http://localhost:3001
   Red:     http://192.168.1.100:3001
```

### Para usar desde la segunda PC
En la segunda PC, abrir el navegador y acceder a:
```
http://192.168.1.100:3001
```
(usando la IP que aparece en la consola de la primera PC)

### Producción (sin el dev server del frontend)
```bash
# Buildear el frontend
cd frontend && npm run build

# Arrancar solo el backend (sirve el frontend también)
cd ../backend && npm start
```
Después acceder desde ambas PCs a `http://IP-PC:3001`

## Funcionalidades

1. **Mesas** - Vista principal con mesas en verde (libre) y rojo (ocupada)
2. **Comandas** - Cargar pedidos, imprimir para cocina, cobrar por separado por persona
3. **Menú** - Administrar categorías e items del menú
4. **Reservas** - Gestión de reservas con nombre, personas y horario
5. **Caja** - Arqueo de caja y caja chica con entradas/salidas y observaciones
6. **Proveedores** - Registro de proveedores y sus pagos
7. **Stock** - Control de mercadería con alertas de stock bajo
8. **Dashboard** - Análiticas diarias, semanales y mensuales

## Base de datos
Los datos se guardan en `backend/data/comandas.db` (SQLite).
Hacer backup de ese archivo regularmente.
