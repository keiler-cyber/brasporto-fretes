'use client';

import { Quotation } from '@/lib/types';
import { getTotalCost } from '@/lib/scoring';
import { formatDate } from '@/lib/utils';
import { Download, Trophy, Award, Star, Plus } from 'lucide-react';

interface RankingDisplayProps {
  quotations: Quotation[];
  onGenerateReport: (quotations: Quotation[]) => void;
  onAddMore?: () => void;
  loading?: boolean;
}

const teal = '#4A9BAA';

function getMedalIcon(pos: number) {
  if (pos === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
  if (pos === 2) return <Award className="w-5 h-5 text-gray-400" />;
  if (pos === 3) return <Award className="w-5 h-5 text-amber-600" />;
  return <Star className="w-4 h-4 text-gray-300" />;
}

function getCardStyle(pos: number) {
  if (pos === 1) return 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50';
  if (pos === 2) return 'border-2 border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50';
  if (pos === 3) return 'border-2 border-amber-500 bg-gradient-to-br from-orange-50 to-amber-50';
  return 'border border-gray-200 bg-white';
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="font-semibold text-gray-900 text-sm">{value}</p>
    </div>
  );
}

export function RankingDisplay({ quotations, onGenerateReport, onAddMore, loading = false }: RankingDisplayProps) {
  const sorted = [...quotations].sort((a, b) => (a.ranking ?? 99) - (b.ranking ?? 99));
  const best = sorted[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Ranking de Cotações</h2>
          <p className="text-gray-500 text-sm">
            {quotations.length} cotações analisadas — ordenadas por pontuação
          </p>
        </div>
        {best && (
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Melhor opção</p>
            <p className="font-bold text-gray-900">{best.extractedData.agentName}</p>
            <p className="text-sm text-[#4A9BAA] font-semibold">{getTotalCost(best.extractedData).toFixed(2)} {best.extractedData.currency}</p>
          </div>
        )}
      </div>

      {/* Critérios */}
      <div className="grid grid-cols-3 gap-3">
        {[['50%', 'Custo Total', 'border-l-[#4A9BAA]'], ['30%', 'Transit Time', 'border-l-blue-400'], ['20%', 'Cond. Operacionais', 'border-l-purple-400']].map(([w, l, c]) => (
          <div key={l} className={`bg-gray-50 rounded-lg p-3 border-l-4 ${c}`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-600">{l}</span>
              <span className="text-base font-black text-gray-900">{w}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Cards */}
      {sorted.length === 0 ? (
        <p className="text-center text-gray-400 py-8">Nenhuma cotação para exibir.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((quote) => {
            const pos = quote.ranking ?? 0;
            const isBest = pos === 1;
            const d = quote.extractedData;
            const total = getTotalCost(d);

            return (
              <div key={quote.id} className={`rounded-xl p-5 ${getCardStyle(pos)}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getMedalIcon(pos)}
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          pos === 1 ? 'bg-yellow-100 text-yellow-800' :
                          pos === 2 ? 'bg-gray-100 text-gray-700' :
                          pos === 3 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                        }`}>#{pos}</span>
                        {isBest && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">MELHOR OPÇÃO</span>}
                      </div>
                      <h3 className="font-bold text-gray-900">{d.agentName}</h3>
                      {d.carrier && <p className="text-xs text-[#4A9BAA] font-medium">{d.carrier}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gray-900">{total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{d.currency} · custo total</p>
                    {d.localChargesBRL && (
                      <p className="text-xs font-semibold text-green-700 mt-0.5">
                        + R$ {d.localChargesBRL.toFixed(2)} no Brasil
                      </p>
                    )}
                    {d.localChargesBRLDesc && (
                      <p className="text-[10px] text-gray-400">{d.localChargesBRLDesc}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pb-3 border-b border-gray-200/70 mb-3">
                  <Field label="Frete Base" value={`${d.baseCost.toFixed(2)} ${d.currency}`} />
                  {d.originCharges ? <Field label="Tx. Origem" value={`${d.originCharges.toFixed(2)} ${d.currency}`} /> : <Field label="Tx. Origem" value="—" />}
                  {d.pickupCost ? <Field label="Pickup" value={`${d.pickupCost.toFixed(2)} ${d.currency}`} /> : <Field label="Pickup" value="—" />}
                  <Field label="Transit Time" value={
                    d.transitTime
                      ? d.transitTimeMax && d.transitTimeMax !== d.transitTime
                        ? `${d.transitTime}–${d.transitTimeMax} dias`
                        : `${d.transitTime} dias`
                      : '—'
                  } />
                  <Field label="ETD" value={d.etd ? formatDate(d.etd) : '—'} />
                </div>

                <div className={`rounded-lg px-3 py-2 text-sm ${isBest ? 'bg-green-50 border border-green-200' : 'bg-white/60'}`}>
                  <span className="font-semibold text-gray-700">{isBest ? 'Por que é a melhor opção: ' : 'Análise: '}</span>
                  <span className="text-gray-600">
                    {(() => {
                      const parts: string[] = [];
                      const same = quotations.filter(q => q.extractedData.currency === d.currency);
                      if (same.length > 1) {
                        const costs = same.map(q => getTotalCost(q.extractedData));
                        if (total === Math.min(...costs)) parts.push(`menor custo total em ${d.currency}`);
                        else { const pct = ((total - Math.min(...costs)) / Math.min(...costs) * 100).toFixed(0); parts.push(`custo ${pct}% acima do menor valor`); }
                      }
                      const ttList = quotations.filter(q => q.extractedData.transitTime != null);
                      if (ttList.length > 1 && d.transitTime != null) {
                        const ttStr = d.transitTimeMax && d.transitTimeMax !== d.transitTime
                          ? `${d.transitTime}–${d.transitTimeMax}d`
                          : `${d.transitTime}d`;
                        if (d.transitTime === Math.min(...ttList.map(q => q.extractedData.transitTime!))) parts.push(`transit time mais rápido (${ttStr})`);
                        else parts.push(`transit time de ${ttStr}`);
                      }
                      return (parts.join('; ') || `custo total: ${total.toFixed(2)} ${d.currency}`) + `. Modal: ${d.modal}${d.incoterm ? ' · ' + d.incoterm : ''}.`;
                    })()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="flex gap-3">
          {onAddMore && (
            <button
              onClick={onAddMore}
              className="flex-1 px-6 py-3 border-2 border-[#4A9BAA] text-[#4A9BAA] hover:bg-[#f0f9fb] rounded-xl transition flex items-center justify-center gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" />
              Adicionar Cotação
            </button>
          )}
          <button
            onClick={() => onGenerateReport(sorted)}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-[#003d4d] hover:bg-[#004d60] disabled:opacity-50 text-white rounded-xl transition flex items-center justify-center gap-2 font-semibold"
          >
            <Download className="w-4 h-4" />
            {loading ? 'Gerando...' : 'Gerar Relatório PDF'}
          </button>
        </div>
      )}
    </div>
  );
}
