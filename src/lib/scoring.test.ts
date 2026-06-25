import { describe, expect, it } from 'vitest';
import { calculateScoring, getEffectiveCost, getTotalCost } from './scoring';
import { ExtractionData } from './types';

describe('scoring', () => {
  it('should calculate total cost including pickup, origin and other charges', () => {
    const quotation: ExtractionData = {
      agentName: 'Agent A',
      modal: 'FCL',
      baseCost: 1000,
      currency: 'USD',
      pickupCost: 150,
      originCharges: 50,
      otherCharges: 25,
      rawData: 'test',
    };

    expect(getTotalCost(quotation)).toBe(1225);
    expect(getEffectiveCost(quotation)).toBe(1225);
  });

  it('should score cheaper FCL quote higher (same currency)', () => {
    const quotations: ExtractionData[] = [
      {
        agentName: 'FCL Agent',
        modal: 'FCL',
        baseCost: 1000,
        currency: 'USD',
        pickupCost: 100,
        originCharges: 50,
        otherCharges: 50,
        rawData: 'fcl',
      },
      {
        agentName: 'FCL Agent 2',
        modal: 'FCL',
        baseCost: 1200,
        currency: 'USD',
        pickupCost: 100,
        originCharges: 50,
        otherCharges: 50,
        rawData: 'fcl2',
      },
    ];

    const scores = calculateScoring(quotations);
    // índice 0 = FCL Agent (mais barato), índice 1 = FCL Agent 2 (mais caro)
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });

  it('should use cost per m³ for LCL when measurement exists', () => {
    const quotation: ExtractionData = {
      agentName: 'LCL Agent',
      modal: 'LCL',
      baseCost: 500,
      currency: 'USD',
      measurement: 10,
      pickupCost: 50,
      originCharges: 25,
      otherCharges: 25,
      rawData: 'lcl',
    };

    expect(getEffectiveCost(quotation)).toBe(60);
  });

  it('should round up weight to whole tonne for LCL fallback', () => {
    const quotation: ExtractionData = {
      agentName: 'LCL Agent',
      modal: 'LCL',
      baseCost: 2000,
      currency: 'USD',
      weight: 1200,
      pickupCost: 100,
      originCharges: 50,
      otherCharges: 50,
      rawData: 'lcl-weight',
    };

    const effective = getEffectiveCost(quotation);
    expect(effective).toBe(2200 / 2); // 2200 total over 2 tonnes (rounded from 1.2 t)
  });

  it('should use billed kg for AEREO with volumetric weight', () => {
    const quotation: ExtractionData = {
      agentName: 'Air Agent',
      modal: 'AEREO',
      baseCost: 1000,
      currency: 'USD',
      weight: 50,
      measurement: 1,
      pickupCost: 100,
      originCharges: 50,
      otherCharges: 50,
      rawData: 'air',
    };

    const effective = getEffectiveCost(quotation);
    expect(effective).toBeCloseTo(1200 / (1 * 166.67), 3);
  });

  it('should compare SEK and EUR quotes together when exchangeRateToEur is set', () => {
    const quotations: ExtractionData[] = [
      {
        // Agente EUR mais caro
        agentName: 'EUR Agent',
        modal: 'AEREO',
        baseCost: 3350,
        currency: 'EUR',
        weight: 500,
        rawData: 'eur',
      },
      {
        // Agente sueco em SEK — mais barato quando convertido (12797 SEK × 0.087 ≈ 1113 EUR)
        agentName: 'SEK Agent',
        modal: 'AEREO',
        baseCost: 12797,
        currency: 'SEK',
        exchangeRateToEur: 0.087,
        weight: 500,
        rawData: 'sek',
      },
    ];

    const scores = calculateScoring(quotations);
    // SEK Agent convertido (≈1113 EUR) é mais barato que EUR Agent (3350 EUR)
    // logo deve ter score maior
    expect(scores[1]).toBeGreaterThan(scores[0]);
  });
});
