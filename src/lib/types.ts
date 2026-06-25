export type TransportMode = 'AEREO' | 'FCL' | 'LCL';

export interface CargoDimension {
  qty: number;
  length: number; // cm
  width: number;  // cm
  height: number; // cm
}

export interface CargoDetails {
  origin: string;
  destination: string;
  weight: number;
  measurement?: number;
  dimensions?: CargoDimension[];
  commodityType?: string;
  desiredModal?: TransportMode;
  incoterm?: string;
  desiredTransitDays?: number;
  billedWeight: number;
  containerType?: string;  // ex: "20DRY", "40HC", "40DRY"
  containerQty?: number;
  clientRef?: string;
  clientName?: string;
  readyDate?: string;
  etaMaximo?: string;
  ncm?: string;
  merchandiseValue?: string;
  observations?: string;
  qtyVolumes?: number;
}

export interface ExtractionData {
  agentName: string;
  modal: TransportMode;
  carrier?: string;
  frequency?: string;  // ex: "DAILY", "3x per week", "MON WED FRI", "Weekly"
  localChargesBRL?: number;   // taxas no Brasil em BRL (THC destino, handling, entrega, etc.) — só para referência, não entra na comparação
  localChargesBRLDesc?: string; // descrição das taxas em BRL
  baseCost: number;
  ratePerKg?: number;
  rateMinWeight?: number;   // mínimo do break tarifário (ex: 100 para +100K)
  effectiveWeight?: number; // peso efetivo usado no cálculo (max(billedWeight, rateMinWeight))
  currency: string;
  incoterm?: string;
  pickupCost?: number;
  originCharges?: number;
  destinationCharges?: number;
  otherCharges?: number;
  transitTime?: number;
  transitTimeMax?: number; // máximo do range (ex: "7-10 dias" → 10)
  customsCharges?: number; // fee de customs calculado sobre valor da mercadoria
  etd?: Date;
  freeTime?: number;
  weight?: number;
  measurement?: number;
  destinationAirport?: string; // aeroporto/porto destino quando há múltiplas opções (ex: "GRU", "VCP")
  exchangeRateToEur?: number; // taxa de câmbio para EUR: permite comparar cotações em SEK/CHF/NOK com cotações em EUR no mesmo ranking
  rawData: string; // Dados brutos do PDF
}

export interface RequestCriteria {
  requestedModal?: TransportMode;
  requestedIncoterm?: string;
  requestedTransitTime?: number;
  requestedFreeTime?: number;
  requestedEtd?: Date;
}

export interface Quotation {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date; // 15 dias após criação
  originalFileName: string;
  pdfUrl: string;
  extractedData: ExtractionData;
  score?: number;
  ranking?: number; // posição no ranking geral (1 = melhor)
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'RANKED';
  sessionRef?: string; // Nº da cotação Brasporto, ex: "6620/26 – AIR"
}

export interface ScoringCriteria {
  cost: number; // 0-1
  transitTime: number; // 0-1
  etd: number; // 0-1
  freeTime: number; // 0-1
}

export interface QuotationSession {
  id: string;
  userId: string;
  createdAt: Date;
  quotations: Quotation[];
  topRanking: Quotation[]; // Top 3
}
