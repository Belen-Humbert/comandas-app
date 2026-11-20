import React from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { fmt } from '../lib/api';

export const PAY_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
];

export const initialPayLines = () => [{ method: 'efectivo', amount: '' }];

const cents = (n) => Math.round(Number(n || 0) * 100);

// Con un solo pago, el monto es siempre el total. Con varios, es lo que se escribió en cada uno.
export const buildPayments = (total, lines) =>
  lines.length === 1
    ? [{ method: lines[0].method, amount: total }]
    : lines.map(l => ({ method: l.method, amount: Number(l.amount) || 0 }));

// Diferencia entre lo pagado y el total: >0 sobra, <0 falta, 0 justo
export const payDiff = (total, lines) =>
  (buildPayments(total, lines).reduce((s, p) => s + cents(p.amount), 0) - cents(total)) / 100;

export const payIsValid = (total, lines) =>
  total > 0 && payDiff(total, lines) === 0 && buildPayments(total, lines).every(p => p.amount > 0);

// Elegir con qué se paga. Si pagan con más de un método se reparte el total en montos
// (ej. $20.000: $10.000 en efectivo y $10.000 por transferencia) y tiene que sumar justo.
export default function PaymentSplit({ total, lines, onChange }) {
  const multi = lines.length > 1;
  const diff = payDiff(total, lines);

  const setLine = (i, patch) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLine = () => {
    const used = lines.map(l => l.method);
    const method = PAY_METHODS.find(m => !used.includes(m.value))?.value || 'efectivo';
    if (!multi) {
      // Del pago único al dividido: se parte el total en dos mitades para arrancar
      const first = Math.ceil(total / 2);
      onChange([{ ...lines[0], amount: String(first) }, { method, amount: String(total - first) }]);
    } else {
      onChange([...lines, { method, amount: String(Math.max(0, -diff)) }]);
    }
  };

  const removeLine = (i) => {
    const next = lines.filter((_, idx) => idx !== i);
    onChange(next);
  };

  return (
    <div data-testid="payment-split">
      <p className="label">Forma de pago</p>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="rounded-xl border border-gray-200 p-2.5">
            <div className="flex gap-1.5">
              {PAY_METHODS.map(m => (
                <button key={m.value} type="button" onClick={() => setLine(i, { method: m.value })}
                  aria-pressed={l.method === m.value} data-testid={`pay-method-${i}-${m.value}`}
                  className={`flex-1 py-1.5 rounded-lg border-2 text-sm font-medium transition-colors ${l.method === m.value ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            {multi && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-400">$</span>
                <input type="number" inputMode="decimal" min="0" step="any" className="input flex-1" placeholder="Monto"
                  aria-label={`Monto del pago ${i + 1}`} data-testid={`pay-amount-${i}`}
                  value={l.amount} onChange={e => setLine(i, { amount: e.target.value })} />
                <button type="button" onClick={() => removeLine(i)} aria-label="Quitar este pago" className="p-2 text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {multi && (
        <p data-testid="pay-remaining" className={`mt-2 text-sm font-medium flex items-center gap-1 ${diff === 0 ? 'text-green-600' : diff < 0 ? 'text-amber-600' : 'text-red-600'}`}>
          {diff === 0 ? <><Check className="w-4 h-4" /> El pago coincide con el total</>
            : diff < 0 ? `Falta pagar ${fmt.currency(-diff)}`
            : `Sobran ${fmt.currency(diff)}: el pago supera el total`}
        </p>
      )}

      {lines.length < 3 && (
        <button type="button" onClick={addLine} data-testid="pay-add"
          className="mt-2 text-sm text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1">
          <Plus className="w-4 h-4" /> {multi ? 'Agregar otro pago' : 'Pagar con más de un método'}
        </button>
      )}
    </div>
  );
}
