// Ticket y mensaje de WhatsApp de los pedidos de Delivery / Take Away.
import { fmt } from './api';

export const TYPE_LABELS = { delivery: 'Delivery', takeaway: 'Take Away' };
export const PAYMENT_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', mixto: 'Mixto' };

// El nombre, la dirección y las observaciones los escribe una persona: se escapan antes de
// ponerlos en el HTML del ticket.
export const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// SQLite guarda "2026-10-15 21:30:00" (hora local del servidor)
const when = (s) => {
  const d = s ? new Date(String(s).replace(' ', 'T')) : new Date();
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

export function buildTicketHTML(order) {
  const label = TYPE_LABELS[order.order_type] || 'Pedido';
  const lines = (order.items || []).map(i =>
    `<div class="item"><span>${escapeHtml(i.quantity)} x ${escapeHtml(i.name)}</span><span>${escapeHtml(fmt.currency(i.quantity * i.unit_price))}</span></div>`
  ).join('');
  return `<html><head><meta charset="utf-8"><style>
    body{font-family:monospace;font-size:14px;padding:10px;max-width:300px}
    h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px}
    p{margin:3px 0}
    .item{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed #ccc}
    .total{display:flex;justify-content:space-between;font-weight:bold;font-size:16px;border-top:2px solid #000;margin-top:8px;padding-top:8px}
    .obs{margin-top:10px;padding:6px;border:1px dashed #000;white-space:pre-wrap}
    .footer{text-align:center;margin-top:12px;font-size:12px;color:#666}
  </style></head><body>
    <h2>${escapeHtml(label.toUpperCase())} #${escapeHtml(order.id)}</h2>
    <p>${escapeHtml(when(order.created_at))}</p>
    <p>Cliente: <strong>${escapeHtml(order.customer_name)}</strong></p>
    ${order.order_type === 'delivery' ? `<p>Dirección: <strong>${escapeHtml(order.customer_address)}</strong></p>` : '<p><strong>Retira en el local</strong></p>'}
    <hr/>
    ${lines}
    <div class="total"><span>TOTAL</span><span>${escapeHtml(fmt.currency(order.total))}</span></div>
    <p style="margin-top:8px">Pago: <strong>${escapeHtml(PAYMENT_LABELS[order.payment_method] || order.payment_method || '-')}</strong></p>
    ${order.notes ? `<div class="obs">Obs: ${escapeHtml(order.notes)}</div>` : ''}
    <div class="footer">Gracias por su compra</div>
  </body></html>`;
}

// Texto del mensaje (WhatsApp usa *asteriscos* para la negrita)
export function buildWhatsAppText(order) {
  const label = TYPE_LABELS[order.order_type] || 'Pedido';
  const out = [`*${label} #${order.id}*`, when(order.created_at), '', `Cliente: ${order.customer_name}`];
  out.push(order.order_type === 'delivery' ? `Dirección: ${order.customer_address}` : 'Retira en el local');
  out.push('');
  (order.items || []).forEach(i => out.push(`${i.quantity} x ${i.name} - ${fmt.currency(i.quantity * i.unit_price)}`));
  out.push('', `*Total: ${fmt.currency(order.total)}*`);
  out.push(`Pago: ${PAYMENT_LABELS[order.payment_method] || order.payment_method || '-'}`);
  if (order.notes) out.push('', `Obs: ${order.notes}`);
  return out.join('\n');
}

export const whatsappUrl = (order) => `https://wa.me/?text=${encodeURIComponent(buildWhatsAppText(order))}`;

export function shareWhatsApp(order) {
  window.open(whatsappUrl(order), '_blank', 'noopener');
}

// Devuelve false si el navegador bloqueó la ventana de impresión
export function printTicket(order) {
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) return false;
  win.document.write(buildTicketHTML(order));
  win.document.close();
  win.print();
  return true;
}
