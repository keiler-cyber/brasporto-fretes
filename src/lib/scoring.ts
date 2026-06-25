import { ExtractionData } from './types';
import { volumetricWeightFromVolume, billedWeight } from './volumetric';

function roundUpToWholeTonne(weightKg: number): number {
  if (!weightKg || weightKg <= 0) return 0;
  return Math.ceil(weightKg / 1000) * 1000;
}

export function normalizeValue(value: number, min: number, max: number): number {
  if (min === max) return 1;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function getTotalCost(q: ExtractionData): number {
  return (
    q.baseCost +
    (q.pickupCost || 0) +
    (q.originCharges || 0) +
    (q.destinationCharges || 0) +
    (q.otherCharges || 0) +
    (q.customsCharges || 0)
  );
}

export function getEffectiveCost(q: ExtractionData): number {
  const totalCost = getTotalCost(q);
  if (q.modal === 'AEREO') {
    // Prioridade: peso declarado pelo agente → calculado da carga
    const billed = q.effectiveWeight || billedWeight(q.weight, q.measurement);
    return billed > 0 ? totalCost / billed : totalCost;
  }
  if (q.modal === 'LCL') {
    if (q.measurement && q.measurement > 0) return totalCost / q.measurement;
    if (q.weight && q.weight > 0) {
      const tonnes = roundUpToWholeTonne(q.weight) / 1000;
      return tonnes > 0 ? totalCost / tonnes : totalCost;
    }
  }
  return totalCost;
}

// Converte frequência textual em score 0-1 (só para AÉREO)
function frequencyScore(freq?: string): number {
  if (!freq) return 0.5;
  const f = freq.toUpperCase();
  if (f.includes('DAILY') || f.includes('DIÁRI') || f.includes('DIARIO')) return 1.0;
  // contar dias da semana mencionados
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN',
                 'SEG','TER','QUA','QUI','SEX','SÁB','SAB','DOM'];
  const count = days.filter(d => f.includes(d)).length;
  if (count >= 6) return 1.0;
  if (count >= 5) return 0.9;
  if (count >= 4) return 0.75;
  if (count >= 3) return 0.6;
  if (count >= 2) return 0.4;
  if (count >= 1) return 0.25;
  // tentar extrair número "3x", "4x per week"
  const match = f.match(/(\d+)\s*[Xx×]/);
  if (match) {
    const n = parseInt(match[1]);
    if (n >= 7) return 1.0;
    if (n >= 5) return 0.85;
    if (n >= 3) return 0.6;
    if (n >= 2) return 0.4;
    return 0.2;
  }
  if (f.includes('WEEK') || f.includes('SEМАН')) return 0.2;
  return 0.5;
}

// Cotações em EUR e cotações com exchangeRateToEur entram no mesmo grupo de comparação
const EUR_BASE = '__EUR__';

function getGroupKey(q: ExtractionData): string {
  if (q.currency === 'EUR') return EUR_BASE;
  if (q.exchangeRateToEur && q.exchangeRateToEur > 0) return EUR_BASE;
  return q.currency;
}

// Custo efetivo convertido para EUR quando exchangeRateToEur está preenchido
export function convertedEffectiveCost(q: ExtractionData): number {
  const cost = getEffectiveCost(q);
  if (q.currency !== 'EUR' && q.exchangeRateToEur && q.exchangeRateToEur > 0) {
    return cost * q.exchangeRateToEur;
  }
  return cost;
}

// ─── SCORING PRINCIPAL ────────────────────────────────────────────────────────
// Retorna array de scores indexado igual ao array de quotations
// Cotações com exchangeRateToEur entram no grupo EUR e competem diretamente

export function calculateScoring(quotations: ExtractionData[]): number[] {
  if (quotations.length === 0) return [];

  // Ranges de custo por grupo (moeda ou EUR-base para cross-currency)
  const groupCosts = quotations.reduce<Record<string, number[]>>((acc, q) => {
    const key = getGroupKey(q);
    const cost = convertedEffectiveCost(q);
    (acc[key] = acc[key] || []).push(cost);
    return acc;
  }, {});
  const currencyRange: Record<string, { min: number; max: number }> = {};
  for (const [key, vals] of Object.entries(groupCosts)) {
    const v = vals.filter(x => x > 0);
    currencyRange[key] = { min: Math.min(...v) || 0, max: Math.max(...v) || 1 };
  }

  // Ranges de transit time
  const tts = quotations.map(q => q.transitTime).filter((t): t is number => t != null);
  const minTT = tts.length > 0 ? Math.min(...tts) : 0;
  const maxTT = tts.length > 0 ? Math.max(...tts) : 1;

  // Ranges de free time
  const fts = quotations.map(q => q.freeTime).filter((f): f is number => f != null && f > 0);
  const minFT = fts.length > 0 ? Math.min(...fts) : 0;
  const maxFT = fts.length > 0 ? Math.max(...fts) : 1;

  return quotations.map(q => {
    const key = getGroupKey(q);
    const range = currencyRange[key] || { min: 0, max: 1 };
    const costScore = 1 - normalizeValue(convertedEffectiveCost(q), range.min, range.max);
    const ttScore   = q.transitTime != null ? 1 - normalizeValue(q.transitTime, minTT, maxTT) : 0;
    const etdScore  = q.etd ? 1 : 0;
    const ftScore   = q.freeTime ? normalizeValue(q.freeTime, minFT, maxFT) : 0;

    let operationalScore: number;
    if (q.modal === 'AEREO') {
      // Para aéreo: frequência tem peso maior nas condições operacionais
      const freqScore = frequencyScore(q.frequency);
      operationalScore = ftScore * 0.2 + etdScore * 0.3 + freqScore * 0.5;
    } else {
      operationalScore = ftScore * 0.6 + etdScore * 0.4;
    }

    return costScore * 0.50 + ttScore * 0.30 + operationalScore * 0.20;
  });
}

// Retorna índices ordenados do melhor para o pior
export function getRanking(scores: number[]): number[] {
  return scores
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.idx);
}

export function getScoreByIndex(idx: number, scores: number[]): number {
  return scores[idx] ?? 0;
}

// Mantidos por compatibilidade (não usar em código novo)
export function getScoreForAgent(agent: string, scores: Map<string, number>): number {
  return scores.get(agent) || 0;
}
