'use client';

import { CargoDetails } from '@/lib/types';
import { volumetricWeightFromVolume } from '@/lib/volumetric';

interface CargoReviewProps {
  data: CargoDetails;
  onChange?: (data: CargoDetails) => void; // mantido por compatibilidade mas não usado
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs font-semibold text-gray-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-900">{value || '—'}</span>
    </div>
  );
}

export function CargoReview({ data }: CargoReviewProps) {
  const cubado = data.measurement ? volumetricWeightFromVolume(data.measurement) : 0;
  const isAereo = data.desiredModal === 'AEREO';
  const isFCL = data.desiredModal === 'FCL';

  const dimString = data.dimensions?.length
    ? data.dimensions.map(d => `${d.qty}cx ${d.length}×${d.width}×${d.height}cm`).join(' | ')
    : null;

  return (
    <div className="space-y-4">
      {/* Info: dados extraídos automaticamente */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700">
        Todos os dados abaixo foram extraídos automaticamente do PDF. Nenhuma edição manual é necessária.
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
        {/* Seção: Identificação */}
        <div className="px-5 py-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Identificação</p>
          <Field label="Cliente" value={data.clientName} />
          <Field label="Referência" value={data.clientRef} />
          <Field label="Modal" value={data.desiredModal} />
          <Field label="Incoterm" value={data.incoterm} />
        </div>

        {/* Seção: Rota */}
        <div className="px-5 py-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Rota</p>
          <Field label="Origem (Coleta)" value={data.origin} />
          <Field label="Destino (Entrega)" value={data.destination} />
          <Field label="Ready Date" value={data.readyDate ? new Date(data.readyDate).toLocaleDateString('pt-BR') : null} />
          <Field label="ETA Máximo" value={data.etaMaximo ? new Date(data.etaMaximo).toLocaleDateString('pt-BR') : null} />
        </div>

        {/* Seção: FCL — Equipamento */}
        {isFCL && (
          <div className="px-5 py-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Equipamento (FCL)</p>
            <Field label="Container" value={data.containerType} />
            <Field label="Quantidade" value={data.containerQty ? `${data.containerQty}x` : null} />
          </div>
        )}

        {/* Seção: Carga */}
        <div className="px-5 py-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Carga</p>
          <Field label="Mercadoria" value={data.commodityType} />
          <Field label="NCM" value={data.ncm} />
          <Field label="Valor Mercadoria" value={data.merchandiseValue} />
          <Field label="Qtd. Volumes" value={data.qtyVolumes ?? data.dimensions?.reduce((s, d) => s + d.qty, 0)} />
          <Field label="Dimensões" value={dimString} />
          <Field label="Peso Bruto" value={data.weight ? `${data.weight} kg` : null} />
          <Field label="Volume" value={data.measurement ? `${data.measurement} m³` : null} />
          {data.observations && <Field label="Observações" value={data.observations} />}
        </div>

        {/* Seção: Peso Taxado (apenas AÉREO) */}
        {isAereo && data.weight && (
          <div className="px-5 py-3 bg-[#f0f9fb]">
            <p className="text-xs font-bold text-[#4A9BAA] uppercase tracking-wide mb-2">Cálculo de Peso Taxado (Aéreo)</p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-gray-500 mb-0.5">Peso Bruto</p>
                <p className="font-semibold text-gray-900">{data.weight} kg</p>
              </div>
              {data.measurement && (
                <div>
                  <p className="text-gray-500 mb-0.5">Peso Cubado</p>
                  <p className="font-semibold text-gray-900">{data.measurement} m³ × 166,67 = {cubado.toFixed(2)} kg</p>
                </div>
              )}
              <div className="bg-[#4A9BAA]/10 rounded-lg p-2">
                <p className="text-[#4A9BAA] font-semibold mb-0.5">Peso Taxado</p>
                <p className="text-lg font-black text-[#4A9BAA]">{data.billedWeight} kg</p>
                <p className="text-[10px] text-gray-400">max(bruto, cubado)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
