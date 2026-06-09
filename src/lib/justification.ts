import { Quotation } from './types';
import { getTotalCost } from './scoring';

export function generateJustification(quote: Quotation, allQuotations: Quotation[]): string {
  const d = quote.extractedData;
  const total = getTotalCost(d);
  const pos = quote.ranking ?? 99;

  // Comparações dentro da mesma moeda
  const sameCur = allQuotations.filter(q => q.extractedData.currency === d.currency);
  const costs = sameCur.map(q => getTotalCost(q.extractedData));
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const isCheapest = total === minCost && sameCur.length > 1;
  const costDiff = minCost > 0 ? ((total - minCost) / minCost * 100).toFixed(0) : null;

  // Transit time
  const withTT = allQuotations.filter(q => q.extractedData.transitTime != null);
  const minTT = withTT.length > 0 ? Math.min(...withTT.map(q => q.extractedData.transitTime!)) : null;
  const isFastest = d.transitTime != null && d.transitTime === minTT && withTT.length > 1;

  const reasons: string[] = [];

  if (pos === 1) {
    if (isCheapest && isFastest) {
      reasons.push(`MENOR CUSTO (${d.currency} ${total.toFixed(2)}) e MENOR TRANSIT TIME (${d.transitTime}d) — melhor em todos os critérios`);
    } else if (isCheapest) {
      reasons.push(`MENOR CUSTO TOTAL: ${d.currency} ${total.toFixed(2)}`);
      if (d.transitTime) reasons.push(`transit time de ${d.transitTime} dias`);
    } else if (isFastest) {
      reasons.push(`MENOR TRANSIT TIME: ${d.transitTime} dias`);
      if (costDiff) reasons.push(`NÃO é o menor frete (${costDiff}% acima do mais barato) — selecionado pelo prazo mais curto`);
    } else {
      const cheapestAgent = sameCur.find(q => getTotalCost(q.extractedData) === minCost);
      const cheapName = cheapestAgent?.extractedData.agentName?.split(' - ')[0] ?? '';
      reasons.push(`NÃO é o menor frete — custo ${costDiff}% acima de ${cheapName} (${d.currency} ${minCost.toFixed(2)})`);
      reasons.push(`selecionado pela melhor combinação de prazo e condições operacionais (score 50/30/20)`);
    }
  } else {
    // Demais posições
    if (isCheapest) {
      reasons.push(`menor custo (${d.currency} ${total.toFixed(2)}), porém score inferior por outros critérios`);
    } else if (costDiff) {
      reasons.push(`custo ${costDiff}% acima da opção mais barata`);
    }
    if (d.transitTime != null && minTT != null) {
      if (isFastest) {
        reasons.push(`menor transit time (${d.transitTime} dias)`);
      } else {
        reasons.push(`transit time de ${d.transitTime} dias`);
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push(`custo ${d.currency} ${total.toFixed(2)}, transit time ${d.transitTime ?? '—'} dias`);
  }

  const prefix = pos === 1 ? 'Recomendada por: ' : 'Análise: ';
  const body = reasons.join(' · ');
  const suffix = ` | Modal: ${d.modal}${d.incoterm ? ' · ' + d.incoterm : ''}`;

  return prefix + body + suffix;
}
