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

  it('should use 1-to-1 comparison for FCL quotes', () => {
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
    expect(scores.get('FCL Agent')).toBeGreaterThan(scores.get('FCL Agent 2'));
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

  it('should prefer a quote that matches requested transit time and free time even if slightly more expensive', () => {
    const quotations: ExtractionData[] = [
      {
        agentName: 'Cheap Agent',
        modal: 'FCL',
        baseCost: 1000,
        currency: 'USD',
        pickupCost: 100,
        originCharges: 50,
        otherCharges: 50,
        transitTime: 20,
        freeTime: 5,
        rawData: 'cheap',
      },
      {
        agentName: 'Requested Agent',
        modal: 'FCL',
        baseCost: 1100,
        currency: 'USD',
        pickupCost: 100,
        originCharges: 50,
        otherCharges: 50,
        transitTime: 15,
        freeTime: 7,
        rawData: 'requested',
      },
    ];

    const scores = calculateScoring(quotations, {
      requestedModal: 'FCL',
      requestedTransitTime: 18,
      requestedFreeTime: 6,
    });

    expect(scores.get('Requested Agent')).toBeGreaterThan(scores.get('Cheap Agent'));
  });
});
