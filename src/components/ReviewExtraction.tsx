'use client';

import { useState, useEffect, useRef } from 'react';
import { ExtractionData } from '@/lib/types';
import { getTotalCost } from '@/lib/scoring';
import { formatDate } from '@/lib/utils';
import { CheckCircle, Clock, Package, RefreshCw, AlertCircle } from 'lucide-react';
import { volumetricWeightFromVolume, billedWeight } from '@/lib/volumetric';

// Moedas que precisam de conversão para EUR (outras moedas europeias fora do Eurozone)
const NON_EUR_CURRENCIES = ['SEK', 'CHF', 'NOK', 'DKK', 'GBP', 'PLN', 'CZK', 'HUF'];

interface PtaxResult {
  rate: number;
  date: string;
  source: string;
  fromBRL: number;
  toBRL: number;
}

async function fetchExchangeRate(from: string): Promise<PtaxResult | null> {
  try {
    const res = await fetch(`/api/exchange-rate?from=${from}&to=EUR`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface ReviewExtractionProps {
  data: ExtractionData;
  fileName: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onDataChange?: (data: ExtractionData) => void;
  loading?: boolean;
  showActions?: boolean;
}

const modalColors: Record<string, string> = {
  AEREO: 'bg-purple-100 text-purple-800',
  FCL: 'bg-blue-100 text-blue-800',
  LCL: 'bg-green-100 text-green-800',
};

function NumInput({
  label, value, onChange, placeholder, highlight,
}: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void;
  placeholder?: string; highlight?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
        placeholder={placeholder ?? '0.00'}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          highlight ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
        }`}
      />
    </div>
  );
}

export function ReviewExtraction({
  data,
  fileName,
  onConfirm,
  onCancel,
  onDataChange,
  loading = false,
  showActions = true,
}: ReviewExtractionProps) {
  const [local, setLocal] = useState<ExtractionData>(data);
  const [ptax, setPtax] = useState<PtaxResult | null>(null);
  const [ptaxLoading, setPtaxLoading] = useState(false);
  const [ptaxError, setPtaxError] = useState('');
  const prevCurrency = useRef('');

  // Busca taxa BCB PTAX automaticamente quando a moeda muda para uma não-EUR
  useEffect(() => {
    const cur = local.currency?.toUpperCase() ?? '';
    if (cur === prevCurrency.current) return;
    prevCurrency.current = cur;

    if (!cur || cur === 'EUR' || !NON_EUR_CURRENCIES.includes(cur)) {
      setPtax(null);
      setPtaxError('');
      // Remove taxa se voltou para EUR ou moeda sem conversão
      setLocal(prev => ({ ...prev, exchangeRateToEur: undefined }));
      return;
    }

    let cancelled = false;
    setPtaxLoading(true);
    setPtaxError('');
    fetchExchangeRate(cur).then(result => {
      if (cancelled) return;
      setPtaxLoading(false);
      if (result?.rate) {
        setPtax(result);
        setLocal(prev => {
          const next = { ...prev, exchangeRateToEur: result.rate };
          onDataChange?.(next);
          return next;
        });
      } else {
        setPtaxError(`Não foi possível obter a taxa ${cur}/EUR do BCB PTAX.`);
      }
    });
    return () => { cancelled = true; };
  }, [local.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<ExtractionData>) => {
    let next = { ...local, ...patch };

    // Auto-recalcular baseCost para AÉREO quando taxa ou pesos mudam
    if (
      next.modal === 'AEREO' &&
      ('ratePerKg' in patch || 'effectiveWeight' in patch || 'rateMinWeight' in patch ||
       'weight' in patch || 'measurement' in patch)
    ) {
      const rate = next.ratePerKg || 0;
      if (rate > 0) {
        const rawBilled = billedWeight(next.weight, next.measurement);
        const minW = next.rateMinWeight || 0;
        // Usar effectiveWeight explícito ou calcular
        const eff = next.effectiveWeight || (rawBilled > 0 ? Math.max(rawBilled, minW) : 0);
        if (eff > 0) {
          if (!next.effectiveWeight) next.effectiveWeight = eff;
          next.baseCost = parseFloat((rate * eff).toFixed(2));
        }
      }
    }

    setLocal(next);
    onDataChange?.(next);
  };

  const cubedWeight = local.measurement ? volumetricWeightFromVolume(local.measurement) : 0;
  const billed = billedWeight(local.weight, local.measurement);

  const missing: string[] = [];
  if (!local.agentName) missing.push('Nome do Agente');
  if (!local.modal) missing.push('Modal');
  if (!local.baseCost) missing.push('Custo Base');
  if (local.modal === 'AEREO' && !local.weight && !local.measurement) missing.push('Peso ou Volume');

  const isValid = !!local.agentName && !!local.modal && !!local.baseCost;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Revisão de Extração</h2>
        <p className="text-sm text-gray-500 mt-0.5">Arquivo: {fileName}</p>
      </div>

      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>Preencher:</strong> {missing.join(', ')}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">

        {/* Agente e Modal */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Agente *</label>
            <input
              type="text"
              value={local.agentName || ''}
              onChange={e => update({ agentName: e.target.value })}
              placeholder="Nome do agente"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !local.agentName ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Modal *</label>
            <input
              type="text"
              value={local.modal || ''}
              onChange={e => update({ modal: e.target.value.toUpperCase() as any })}
              placeholder="AEREO / FCL / LCL"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !local.modal ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
            {local.modal && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${modalColors[local.modal] ?? 'bg-gray-100 text-gray-700'}`}>
                {local.modal}
              </span>
            )}
          </div>
        </div>

        {/* Carrier e Aeroporto Destino */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Carrier</label>
            <input
              type="text"
              value={local.carrier || ''}
              onChange={e => update({ carrier: e.target.value })}
              placeholder="Cia aérea ou armador"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              {local.modal === 'FCL' || local.modal === 'LCL' ? 'Porto Destino' : 'Aeroporto Destino'}
            </label>
            <input
              type="text"
              value={local.destinationAirport || ''}
              onChange={e => update({ destinationAirport: e.target.value.toUpperCase() || undefined })}
              placeholder="ex: GRU, VCP, CGH"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Frete base e Moeda */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Frete Base *</label>
            <input
              type="number"
              value={local.baseCost || ''}
              onChange={e => update({ baseCost: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !local.baseCost ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Moeda</label>
            <input
              type="text"
              value={local.currency || ''}
              onChange={e => update({ currency: e.target.value.toUpperCase() })}
              placeholder="USD"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Conversão para EUR via BCB PTAX — aparece para moedas não-EUR conhecidas */}
        {local.currency && NON_EUR_CURRENCIES.includes(local.currency.toUpperCase()) && (
          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                Conversão para EUR — BCB PTAX
              </p>
              {!ptaxLoading && (
                <button
                  type="button"
                  onClick={() => {
                    prevCurrency.current = '';
                    setLocal(prev => ({ ...prev })); // re-trigger effect via re-render
                    const cur = local.currency?.toUpperCase() ?? '';
                    if (!cur || !NON_EUR_CURRENCIES.includes(cur)) return;
                    setPtaxLoading(true);
                    setPtaxError('');
                    fetchExchangeRate(cur).then(result => {
                      setPtaxLoading(false);
                      if (result?.rate) {
                        setPtax(result);
                        setLocal(prev => {
                          const next = { ...prev, exchangeRateToEur: result.rate };
                          onDataChange?.(next);
                          return next;
                        });
                      } else {
                        setPtaxError(`Não foi possível obter a taxa ${cur}/EUR.`);
                      }
                    });
                  }}
                  className="text-blue-500 hover:text-blue-700 transition"
                  title="Atualizar taxa"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {ptaxLoading && (
              <p className="text-xs text-blue-500 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" /> Consultando BCB PTAX…
              </p>
            )}

            {ptaxError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" /> {ptaxError}
              </p>
            )}

            {ptax && local.exchangeRateToEur && (
              <div className="space-y-1.5">
                <div className="bg-white rounded-lg px-3 py-2 border border-blue-100 font-mono text-xs space-y-0.5">
                  <p className="text-gray-500">
                    1 {local.currency} = {local.exchangeRateToEur.toFixed(6)} EUR
                    <span className="ml-2 text-blue-400">(cotação de {ptax.date})</span>
                  </p>
                  <p className="text-gray-500 text-[10px]">
                    {local.currency}/BRL: {ptax.fromBRL.toFixed(4)} · EUR/BRL: {ptax.toBRL.toFixed(4)} · Fonte: {ptax.source}
                  </p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-gray-700">
                    {getTotalCost(local).toFixed(2)} <span className="font-medium text-gray-900">{local.currency}</span>
                  </span>
                  <span className="text-gray-400">≈</span>
                  <span className="text-base font-bold text-blue-700">
                    {(getTotalCost(local) * local.exchangeRateToEur).toFixed(2)} EUR
                  </span>
                </div>
                <p className="text-[11px] text-blue-500">
                  Esta cotação será comparada com as cotações em EUR no ranking.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Peso e Volume — editáveis */}
        <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
              <Package className="w-3 h-3" /> Peso Bruto (kg)
            </label>
            <input
              type="number"
              value={local.weight ?? ''}
              onChange={e => update({ weight: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
              placeholder="kg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Volume (m³)</label>
            <input
              type="number"
              value={local.measurement ?? ''}
              onChange={e => update({ measurement: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
              placeholder="m³"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Cálculo por kg — apenas AÉREO */}
        {local.modal === 'AEREO' && (
          <div className="border border-blue-100 rounded-lg p-3 bg-blue-50 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Cálculo por Kg (Aéreo)</p>
            <div className="grid grid-cols-3 gap-3">
              <NumInput
                label="Taxa / kg"
                value={local.ratePerKg}
                onChange={v => update({ ratePerKg: v })}
                placeholder="ex: 8.50"
              />
              <NumInput
                label="Break mínimo (kg)"
                value={local.rateMinWeight}
                onChange={v => update({ rateMinWeight: v })}
                placeholder="ex: 45, 100"
              />
              <NumInput
                label="Peso efetivo (kg)"
                value={local.effectiveWeight}
                onChange={v => update({ effectiveWeight: v })}
                placeholder="auto-calculado"
              />
            </div>
            {local.ratePerKg && local.effectiveWeight ? (
              <p className="text-xs text-blue-600 font-mono">
                {local.ratePerKg} × {local.effectiveWeight} kg ={' '}
                <strong>{(local.ratePerKg * local.effectiveWeight).toFixed(2)} {local.currency}</strong>
                {' '}<span className="text-blue-400">(atualiza Frete Base automaticamente)</span>
              </p>
            ) : null}
          </div>
        )}

        {/* Memória de cálculo — peso taxado */}
        {local.modal === 'AEREO' && (local.weight || local.measurement) && (
          <div className="border-t border-gray-100 pt-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              Memória de Cálculo — Peso Taxado (Aéreo)
            </label>
            <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono space-y-1 text-gray-700">
              <p>Peso bruto:    {local.weight ? `${local.weight} kg` : '—'}</p>
              <p>Volume:        {local.measurement ? `${local.measurement} m³` : '—'}</p>
              <p>Fator:         166,67 kg/m³</p>
              {local.measurement ? (
                <p>Peso cubado:   {local.measurement} × 166,67 = <strong>{cubedWeight.toFixed(2)} kg</strong></p>
              ) : null}
              <p className="pt-1 border-t border-gray-200">
                Peso taxado: max({local.weight ?? 0}{local.measurement ? `, ${cubedWeight.toFixed(2)}` : ''}) ={' '}
                <strong className="text-blue-700">{billed.toFixed(2)} kg</strong>
                {'  '}
                {billed > 0 && (billed === cubedWeight && cubedWeight > (local.weight ?? 0)
                  ? '← cubado prevalece'
                  : '← bruto prevalece')}
              </p>
            </div>
          </div>
        )}

        {/* Transit Time, ETD, Free Time, Incoterm */}
        <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3" /> Transit Time (dias)
            </label>
            <input
              type="number"
              value={local.transitTime ?? ''}
              onChange={e => update({ transitTime: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
              placeholder="dias"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">ETD</label>
            <p className="text-sm text-gray-900 py-2">{local.etd ? formatDate(local.etd) : '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Free Time (dias)</label>
            <input
              type="number"
              value={local.freeTime ?? ''}
              onChange={e => update({ freeTime: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
              placeholder="dias"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Incoterm</label>
            <input
              type="text"
              value={local.incoterm || ''}
              onChange={e => update({ incoterm: e.target.value.toUpperCase() || undefined })}
              placeholder="EXW / FOB / CIF"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Taxas e Despesas — todas editáveis */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Taxas e Despesas</p>
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Pickup / Coleta" value={local.pickupCost} onChange={v => update({ pickupCost: v })} />
            <NumInput label="Taxas Origem" value={local.originCharges} onChange={v => update({ originCharges: v })} />
            <NumInput label="Taxas Destino" value={local.destinationCharges} onChange={v => update({ destinationCharges: v })} />
            <NumInput label="Outras Despesas" value={local.otherCharges} onChange={v => update({ otherCharges: v })} />
          </div>
        </div>

        {/* Custo Total calculado */}
        <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custo Total (sem BRL)</span>
          <span className="text-base font-bold text-gray-900">{getTotalCost(local).toFixed(2)} {local.currency}</span>
        </div>

        {local.customsCharges ? (
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="font-semibold text-amber-700 text-xs uppercase">Customs / Desembaraço</p>
            <p className="text-amber-800 font-medium">{local.customsCharges.toFixed(2)} {local.currency}</p>
          </div>
        ) : null}

        {(local.localChargesBRL || local.localChargesBRLDesc) && (
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-green-700 uppercase">Taxas no Brasil (BRL) — apenas referência</p>
            {local.localChargesBRL && <p className="font-semibold text-green-800">R$ {local.localChargesBRL.toFixed(2)}</p>}
            {local.localChargesBRLDesc && <p className="text-xs text-green-700">{local.localChargesBRLDesc}</p>}
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValid || loading}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium"
          >
            {loading ? (
              <span className="animate-pulse">Processando...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirmar Extração
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
