import { Quotation } from './types';
import { getTotalCost } from './scoring';

export function generateJustification(quote: Quotation, allQuotations: Quotation[]): string {
  const d = quote.extractedData;
  const total = getTotalCost(d);
  const pos = quote.ranking ?? 99;

  // Grupo de comparação: EUR-base (EUR + cotações com taxa) ou mesma moeda
  const isEurBase = (q: Quotation) =>
    q.extractedData.currency === 'EUR' || (!!q.extractedData.exchangeRateToEur && q.extractedData.exchangeRateToEur > 0);
  const thisIsEurBase = isEurBase(quote);
  const sameCur = thisIsEurBase
    ? allQuotations.filter(isEurBase)
    : allQuotations.filter(q => q.extractedData.currency === d.currency);

  const getComparableCost = (q: Quotation) => {
    const qd = q.extractedData;
    return (thisIsEurBase && qd.currency !== 'EUR' && qd.exchangeRateToEur)
      ? getTotalCost(qd) * qd.exchangeRateToEur
      : getTotalCost(qd);
  };
  const comparableTotal = getComparableCost(quote);
  const costs = sameCur.map(getComparableCost);
  const minCost = Math.min(...costs);
  const isCheapest = comparableTotal === minCost && sameCur.length > 1;
  const costDiff = minCost > 0 ? ((comparableTotal - minCost) / minCost * 100).toFixed(0) : null;
  const eurSuffix = thisIsEurBase && d.currency !== 'EUR' ? ' EUR' : ` ${d.currency}`;

  // Transit time
  const withTT = allQuotations.filter(q => q.extractedData.transitTime != null);
  const minTT = withTT.length > 0 ? Math.min(...withTT.map(q => q.extractedData.transitTime!)) : null;
  const isFastest = d.transitTime != null && d.transitTime === minTT && withTT.length > 1;

  // Sufixo de custo: mostra conversão EUR quando aplicável
  const costLabel = d.exchangeRateToEur && d.currency !== 'EUR'
    ? `${d.currency} ${total.toFixed(2)} ≈ ${comparableTotal.toFixed(2)} EUR`
    : `${d.currency} ${total.toFixed(2)}`;

  const reasons: string[] = [];

  if (pos === 1) {
    if (isCheapest && isFastest) {
      reasons.push(`MENOR CUSTO (${costLabel}) e MENOR TRANSIT TIME (${d.transitTime}d) — melhor em todos os critérios`);
    } else if (isCheapest) {
      reasons.push(`MENOR CUSTO TOTAL: ${costLabel}`);
      if (d.transitTime) reasons.push(`transit time de ${d.transitTime} dias`);
    } else if (isFastest) {
      reasons.push(`MENOR TRANSIT TIME: ${d.transitTime} dias`);
      if (costDiff) reasons.push(`NÃO é o menor frete (${costDiff}% acima do mais barato) — selecionado pelo prazo mais curto`);
    } else {
      const cheapestAgent = sameCur.find(q => getComparableCost(q) === minCost);
      const cheapName = cheapestAgent?.extractedData.agentName?.split(' - ')[0] ?? '';
      reasons.push(`NÃO é o menor frete — custo ${costDiff}% acima de ${cheapName} (${minCost.toFixed(2)}${eurSuffix})`);
      reasons.push(`selecionado pela melhor combinação de prazo e condições operacionais (score 50/30/20)`);
    }
  } else {
    // Demais posições
    if (isCheapest) {
      reasons.push(`menor custo (${costLabel}), porém score inferior por outros critérios`);
    } else if (costDiff) {
      reasons.push(`custo ${costDiff}% acima da opção mais barata (${minCost.toFixed(2)}${eurSuffix})`);
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
    reasons.push(`custo ${costLabel}, transit time ${d.transitTime ?? '—'} dias`);
  }

  const prefix = pos === 1 ? 'Recomendada por: ' : 'Análise: ';
  const body = reasons.join(' · ');
  const suffix = ` | Modal: ${d.modal}${d.incoterm ? ' · ' + d.incoterm : ''}`;

  return prefix + body + suffix;
}
