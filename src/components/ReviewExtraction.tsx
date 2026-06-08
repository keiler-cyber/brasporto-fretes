'use client';

import { useState } from 'react';
import { ExtractionData } from '@/lib/types';
import { getTotalCost } from '@/lib/scoring';
import { formatDate } from '@/lib/utils';
import { CheckCircle, Clock, Package } from 'lucide-react';
import { volumetricWeightFromVolume, billedWeight } from '@/lib/volumetric';

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

  const update = (patch: Partial<ExtractionData>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onDataChange?.(next);
  };

  const cubedWeight = local.measurement ? volumetricWeightFromVolume(local.measurement) : 0;
  const billed = billedWeight(local.weight, local.measurement);

  const missing: string[] = [];
  if (!local.agentName) missing.push('Nome do Agente');
  if (!local.modal) missing.push('Modal');
  if (!local.baseCost) missing.push('Custo Base');
  if (local.modal === 'AEREO' && !local.weight) missing.push('Peso (requerido para Aéreo)');
  if (local.modal === 'FCL' && !local.freeTime) missing.push('Free Time (requerido para FCL)');

  const isValid = !!local.agentName && !!local.modal && !!local.baseCost;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Revisão de Extração</h2>
        <p className="text-sm text-gray-500 mt-0.5">Arquivo: {fileName}</p>
      </div>

      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>Campos para preencher:</strong> {missing.join(', ')}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        {/* Agente e Modal — editáveis */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Agente *
            </label>
            <input
              type="text"
              value={local.agentName || ''}
              onChange={(e) => update({ agentName: e.target.value })}
              placeholder="Nome do agente"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !local.agentName ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Modal *
            </label>
            <input
              type="text"
              value={local.modal || ''}
              onChange={(e) => update({ modal: e.target.value.toUpperCase() as any })}
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

        {/* Custo base — editável */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Frete Base *
            </label>
            <input
              type="number"
              value={local.baseCost || ''}
              onChange={(e) => update({ baseCost: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !local.baseCost ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Moeda
            </label>
            <input
              type="text"
              value={local.currency || ''}
              onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
              placeholder="USD"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3" /> Transit Time
            </label>
            <p className="text-sm text-gray-900">{local.transitTime ? `${local.transitTime} dias` : '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">ETD</label>
            <p className="text-sm text-gray-900">{local.etd ? formatDate(local.etd) : '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Free Time</label>
            <p className="text-sm text-gray-900">{local.freeTime ? `${local.freeTime} dias` : '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Incoterm</label>
            <p className="text-sm text-gray-900">{local.incoterm || '—'}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
              <Package className="w-3 h-3" /> Peso Bruto
            </label>
            <p className="text-sm text-gray-900">{local.weight ? `${local.weight} kg` : '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Volume</label>
            <p className="text-sm text-gray-900">{local.measurement ? `${local.measurement} m³` : '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Custo Total</label>
            <p className="text-sm font-semibold text-gray-900">{getTotalCost(local).toFixed(2)} {local.currency}</p>
          </div>
        </div>

        {/* Memória de cálculo — peso cubado (apenas AEREO) */}
        {local.modal === 'AEREO' && (local.weight || local.measurement) && (
          <div className="border-t border-gray-100 pt-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              Memória de Cálculo — Peso Taxado (Aéreo)
            </label>
            <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono space-y-1 text-gray-700">
              <p>Peso bruto:        {local.weight ? `${local.weight} kg` : '—'}</p>
              <p>Volume:            {local.measurement ? `${local.measurement} m³` : '—'}</p>
              <p>Fator cubagem:     166,67 kg/m³  (padrão IATA: 1 m³ = 166,67 kg)</p>
              {local.measurement ? (
                <p>Peso cubado:       {local.measurement} × 166,67 = <strong>{cubedWeight.toFixed(2)} kg</strong></p>
              ) : null}
              <p className="pt-1 border-t border-gray-200">
                Peso taxado:{'       '}
                max({local.weight ?? 0}{local.measurement ? `, ${cubedWeight.toFixed(2)}` : ''}) = <strong className="text-blue-700">{billed.toFixed(2)} kg</strong>
                {'  '}
                {billed > 0 && (billed === cubedWeight && cubedWeight > (local.weight ?? 0)
                  ? '← peso cubado prevalece'
                  : '← peso bruto prevalece')}
              </p>
              {billed > 0 && getTotalCost(local) > 0 && (
                <p className="pt-1 border-t border-gray-200">
                  Custo total:{'       '}
                  {local.baseCost ?? 0}
                  {local.pickupCost ? ` + ${local.pickupCost} (pickup)` : ''}
                  {local.originCharges ? ` + ${local.originCharges} (origem)` : ''}
                  {local.otherCharges ? ` + ${local.otherCharges} (outros)` : ''}
                  {' = '}<strong>{getTotalCost(local).toFixed(2)} {local.currency}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Taxas adicionais detalhadas */}
        <div className="border-t border-gray-100 pt-4">{/* placeholder to close grid */}
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-700 text-xs uppercase">Pickup / Coleta</p>
            <p>{local.pickupCost ? `${local.pickupCost.toFixed(2)} ${local.currency}` : '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 text-xs uppercase">Taxas Origem</p>
            <p className="text-xs text-gray-500">(THC, X-RAY, SFS, FSC, handling…)</p>
            <p>{local.originCharges ? `${local.originCharges.toFixed(2)} ${local.currency}` : '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 text-xs uppercase">Outras Despesas</p>
            <p>{local.otherCharges ? `${local.otherCharges.toFixed(2)} ${local.currency}` : '—'}</p>
          </div>
        </div>
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
