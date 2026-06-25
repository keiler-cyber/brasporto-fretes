'use client';

import { CargoDetails, Quotation } from '@/lib/types';
import { getTotalCost } from '@/lib/scoring';
import { generateJustification } from '@/lib/justification';
import { formatDate } from '@/lib/utils';
import { Document, Page, Text, View, StyleSheet, Image as PDFImage } from '@react-pdf/renderer';

function getDecisionLabel(q: Quotation, all: Quotation[]): { label: string; color: string; bg: string } {
  const pos = q.ranking ?? 99;
  // Apenas usar o número de ranking formatado com 2 dígitos
  const rankingNumber = String(pos).padStart(2, '0');
  
  if (pos === 1) {
    return { label: rankingNumber, color: '#b45309', bg: '#fffbeb' }; // Ouro para 1º lugar
  }
  if (pos === 2) {
    return { label: rankingNumber, color: '#64748b', bg: '#f1f5f9' }; // Cinza para 2º lugar
  }
  if (pos === 3) {
    return { label: rankingNumber, color: '#64748b', bg: '#f8fafc' }; // Cinza claro para 3º lugar
  }
  return { label: rankingNumber, color: '#64748b', bg: '#f8fafc' }; // Padrão para outros
}

const NAVY  = '#003d4d';
const TEAL  = '#4A9BAA';
const GOLD  = '#b45309';
const GOLD_BG = '#fffbeb';
const GREEN = '#166534';
const GREEN_BG = '#f0fdf4';
const GRAY  = '#64748b';
const LIGHT = '#f8fafc';
const BORDER = '#cbd5e1';
const WHITE = '#ffffff';
const RED = '#dc2626';

const LOGO_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/brasporto-logo.png`
  : '/brasporto-logo.png';

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: WHITE, padding: 0, fontSize: 7 },

  // ─── HEADER ────────────────────────────────────────────────────────────────
  header: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: NAVY, minHeight: 55 },
  hLogo: { width: 145, justifyContent: 'center', alignItems: 'center', padding: 8, borderRightWidth: 1, borderRightColor: BORDER },
  hCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hTitle: { fontSize: 15, fontWeight: 'bold', color: NAVY, letterSpacing: 0.5 },
  hSub: { fontSize: 8, color: TEAL, marginTop: 3 },
  hRight: { width: 130, padding: 8, borderLeftWidth: 1, borderLeftColor: BORDER, justifyContent: 'center' },
  hRow: { flexDirection: 'row', marginBottom: 4 },
  hLabel: { fontSize: 6.5, color: GRAY, fontWeight: 'bold', width: 70 },
  hValue: { fontSize: 6.5, color: TEAL, fontWeight: 'bold' },

  // ─── STEPS ─────────────────────────────────────────────────────────────────
  steps: { flexDirection: 'row', backgroundColor: TEAL, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  stepWrap: { flex: 1, alignItems: 'center' },
  stepText: { fontSize: 5.5, color: WHITE, fontWeight: 'bold', textAlign: 'center' },
  stepArrow: { fontSize: 10, color: WHITE, opacity: 0.6, marginHorizontal: 2 },

  // ─── SUMMARY BOXES ─────────────────────────────────────────────────────────
  summaryRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  sBox: { borderRightWidth: 1, borderRightColor: BORDER },
  sTitle: { padding: 4, paddingLeft: 6 },
  sTitleText: { fontSize: 6.5, fontWeight: 'bold', color: WHITE, letterSpacing: 0.3 },
  sBody: { padding: 5 },
  sRow: { flexDirection: 'row', marginBottom: 2.5 },
  sLabel: { fontSize: 6, color: GRAY, fontWeight: 'bold', width: 100 },
  sValue: { fontSize: 6, color: '#1e293b', flex: 1 },
  // conformidade
  confRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2.5, paddingHorizontal: 6 },
  confLabel: { fontSize: 6, color: '#1e293b', flex: 1 },
  confOk: { fontSize: 6, fontWeight: 'bold', color: GREEN, width: 18, textAlign: 'center' },
  confCheck: { fontSize: 7, color: GREEN, width: 14, textAlign: 'center' },

  // ─── MAIN TABLE ────────────────────────────────────────────────────────────
  tableTitle: { backgroundColor: NAVY, padding: 4, paddingLeft: 8, marginHorizontal: 8 },
  tableTitleText: { fontSize: 7, fontWeight: 'bold', color: WHITE, letterSpacing: 0.5 },
  tGroupHdr: { flexDirection: 'row', backgroundColor: '#1a5568', marginHorizontal: 8 },
  tColHdr: { flexDirection: 'row', backgroundColor: '#0f3344', marginHorizontal: 8 },
  th: { fontSize: 5.5, color: WHITE, textAlign: 'center', fontWeight: 'bold', paddingVertical: 2.5, paddingHorizontal: 1 },
  thL: { fontSize: 5.5, color: WHITE, textAlign: 'left', fontWeight: 'bold', paddingVertical: 2.5, paddingHorizontal: 2 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER, marginHorizontal: 8, paddingVertical: 2.5 },
  tRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER, marginHorizontal: 8, paddingVertical: 2.5, backgroundColor: LIGHT },
  tRowBest: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f59e0b', marginHorizontal: 8, paddingVertical: 2.5, backgroundColor: GOLD_BG },
  td: { fontSize: 6, color: '#1e293b', textAlign: 'center', paddingHorizontal: 1 },
  tdL: { fontSize: 6, color: '#1e293b', textAlign: 'left', paddingHorizontal: 2 },
  tdBold: { fontSize: 6, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 1 },

  // col widths
  cAgent: { width: 78 },
  cModal: { width: 24 },
  cRate:  { width: 34 },
  cVal:   { width: 38 },
  cTot:   { width: 44 },
  cOp:    { width: 28 },
  cSm:    { width: 26 },
  cScore: { width: 32 },

  // ─── BOTTOM ────────────────────────────────────────────────────────────────
  bottom: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6, gap: 6 },
  bCard: { flex: 1, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  bTitle: { backgroundColor: NAVY, padding: 4 },
  bTitleText: { fontSize: 6.5, fontWeight: 'bold', color: WHITE },
  bBody: { padding: 5 },
  bRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2.5 },
  bLabel: { fontSize: 6, color: GRAY },
  bValue: { fontSize: 6, color: NAVY, fontWeight: 'bold' },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2.5, borderRadius: 2, padding: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 3 },
  decCard: { flex: 2.5, borderWidth: 1, borderColor: '#f59e0b', borderRadius: 3 },
  decTitle: { backgroundColor: GOLD, padding: 4 },
  decTitleText: { fontSize: 6.5, fontWeight: 'bold', color: WHITE, textAlign: 'center' },
  decBody: { flexDirection: 'row', gap: 5, padding: 5, backgroundColor: GOLD_BG },
  decCol: { flex: 1 },
  decColTitle: { fontSize: 6.5, fontWeight: 'bold', color: NAVY, textAlign: 'center', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#f59e0b' },
  decRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  decLabel: { fontSize: 6, color: GRAY },
  decValue: { fontSize: 6, fontWeight: 'bold', color: NAVY },
  rankRow: { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: BORDER },

  footer: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDER },
  footText: { fontSize: 6, color: GRAY },
});

function sc(v: number) { return v >= 0.8 ? GREEN : v >= 0.6 ? '#ca8a04' : v >= 0.4 ? '#ea580c' : RED; }
function scBg(v: number) { return v >= 0.8 ? GREEN_BG : v >= 0.6 ? '#fefce8' : v >= 0.4 ? '#fff7ed' : '#fef2f2'; }

interface ReportPDFProps {
  quotations: Quotation[];
  topRanking?: Quotation[];
  cargo?: CargoDetails;
}

function dimString(cargo?: CargoDetails) {
  if (!cargo?.dimensions?.length) return '-';
  return cargo.dimensions.map(d => `${d.qty}cx ${d.length}×${d.width}×${d.height}cm`).join(' / ');
}

export function ReportPDF({ quotations, cargo }: ReportPDFProps) {
  const sorted = [...quotations].sort((a, b) => (a.ranking ?? 99) - (b.ranking ?? 99));
  const best = sorted[0];
  const second = sorted[1];
  const cur = best?.extractedData.currency || 'USD';
  const hasCrossCurrency = sorted.some(q => q.extractedData.exchangeRateToEur && q.extractedData.currency !== 'EUR');
  const date = new Date().toLocaleDateString('pt-BR');

  // Retorna custo em EUR equivalente (para cross-currency)
  const eurTotal = (q: Quotation) => {
    const t = getTotalCost(q.extractedData);
    const d = q.extractedData;
    return d.exchangeRateToEur && d.currency !== 'EUR' ? t * d.exchangeRateToEur : t;
  };
  const reportId = `BP-${new Date().getFullYear()}-${String(quotations.length).padStart(3, '0')}`;

  const getRoute = (name: string) => { const m = name.match(/\(([^)]+)\)/); return m ? m[1] : '-'; };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ════ HEADER ════ */}
        <View style={s.header}>
          <View style={s.hLogo}>
            <PDFImage src={LOGO_URL} style={{ width: 120, objectFit: 'contain' }} />
          </View>
          <View style={s.hCenter}>
            <Text style={s.hTitle}>COMPARADOR DE COTAÇÕES DE FRETE</Text>
            <Text style={s.hSub}>AIR / LCL / FCL – COM VALIDAÇÃO E SCORE OPERACIONAL</Text>
          </View>
          <View style={s.hRight}>
            {[['ID DA COTAÇÃO:', reportId], ['DATA:', date], ['RESPONSÁVEL:', '']].map(([l, v]) => (
              <View key={l} style={s.hRow}>
                <Text style={s.hLabel}>{l}</Text>
                <Text style={s.hValue}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ════ PROCESS STEPS ════ */}
        <View style={s.steps}>
          {['1. SOLICITAÇÃO\nDO CLIENTE', '→', '2. CONFERÊNCIA\nLOGÍSTICA', '→', '3. COTAÇÕES\nDOS AGENTES', '→', '4. VALIDAÇÃO E\nCOMPARAÇÃO', '→', '5. DECISÃO'].map((t, i) => (
            t === '→'
              ? <Text key={i} style={s.stepArrow}>›</Text>
              : <View key={i} style={s.stepWrap}><Text style={s.stepText}>{t}</Text></View>
          ))}
        </View>

        {/* ════ SUMMARY BOXES ════ */}
        <View style={s.summaryRow}>

          {/* BOX 1 — Resumo da Solicitação */}
          <View style={[s.sBox, { flex: 2 }]}>
            <View style={[s.sTitle, { backgroundColor: '#1a5568' }]}>
              <Text style={s.sTitleText}>RESUMO DA SOLICITAÇÃO DO CLIENTE (E-MAIL)</Text>
            </View>
            <View style={s.sBody}>
              {[
                ['Cliente:', cargo?.clientName || '-'],
                ['Referência Cliente:', cargo?.clientRef || '-'],
                ['Modal:', cargo?.desiredModal || '-'],
                ['Incoterm:', cargo?.incoterm || '-'],
                ['Origem (Coleta):', cargo?.origin || '-'],
                ['Destino (Entrega):', cargo?.destination || '-'],
                ['Ready Date:', cargo?.readyDate ? new Date(cargo.readyDate).toLocaleDateString('pt-BR') : '-'],
                ['ETA Máximo:', cargo?.etaMaximo ? new Date(cargo.etaMaximo).toLocaleDateString('pt-BR') : '-'],
                ['Descrição da Carga:', cargo?.commodityType || '-'],
                ['NCM:', cargo?.ncm || 'N/A'],
                ['Valor Mercadoria:', cargo?.merchandiseValue || '-'],
                ['Observações / Restrições:', cargo?.observations || 'N/A'],
              ].map(([l, v]) => (
                <View key={l} style={s.sRow}>
                  <Text style={s.sLabel}>{l}</Text>
                  <Text style={s.sValue}>{v}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* BOX 2 — Dados Confirmados */}
          <View style={[s.sBox, { flex: 2 }]}>
            <View style={[s.sTitle, { backgroundColor: '#1a5568' }]}>
              <Text style={s.sTitleText}>DADOS CONFIRMADOS (BASE OFICIAL)</Text>
            </View>
            <View style={s.sBody}>
              {[
                ['Referência / Processo:', cargo?.clientRef || '-'],
                ['Cliente:', cargo?.clientName || '-'],
                ['Modal:', cargo?.desiredModal || '-'],
                ['Incoterm:', cargo?.incoterm || '-'],
                ['Origem (Coleta):', cargo?.origin || '-'],
                ['Destino (Entrega):', cargo?.destination || '-'],
                ['Peso Bruto Total:', cargo?.weight ? `${cargo.weight} kg` : '-'],
                ['Peso Cubado / Chargeable:', cargo?.billedWeight ? `${cargo.billedWeight} kg` : '-'],
                ['Quantidade de Volumes:', cargo?.qtyVolumes ? String(cargo.qtyVolumes) : cargo?.dimensions?.length ? String(cargo.dimensions.reduce((s, d) => s + d.qty, 0)) : '-'],
                ['Dimensões (cm):', dimString(cargo)],
                ['Commodity / NCM:', cargo?.commodityType || '-'],
                ['Ready Date:', cargo?.readyDate ? new Date(cargo.readyDate).toLocaleDateString('pt-BR') : '-'],
                ['ETA Máximo / Prazo de Entrega:', cargo?.etaMaximo ? new Date(cargo.etaMaximo).toLocaleDateString('pt-BR') : '-'],
                ['Observações / Restrições:', cargo?.observations || 'N/A'],
              ].map(([l, v]) => (
                <View key={l} style={s.sRow}>
                  <Text style={s.sLabel}>{l}</Text>
                  <Text style={s.sValue}>{v}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* BOX 3 — Conformidade */}
          <View style={[s.sBox, { flex: 1, borderRightWidth: 0 }]}>
            <View style={[s.sTitle, { backgroundColor: '#1a5568' }]}>
              <Text style={s.sTitleText}>CONFORMIDADE</Text>
            </View>
            <View style={[s.sBody, { paddingHorizontal: 4 }]}>
              {/* Header */}
              <View style={[s.confRow, { borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 2, marginBottom: 3 }]}>
                <Text style={[s.confLabel, { fontWeight: 'bold', fontSize: 5.5, color: GRAY }]}>Campo</Text>
                <Text style={[s.confOk, { color: GRAY, fontSize: 5.5 }]}>OK</Text>
                <Text style={[s.confCheck, { color: GRAY, fontSize: 5.5 }]}>✓</Text>
              </View>
              {[
                ['Cliente', !!cargo?.clientName],
                ['Referência / Processo', !!cargo?.clientRef],
                ['Modal', !!cargo?.desiredModal],
                ['Incoterm', !!cargo?.incoterm],
                ['Origem', !!cargo?.origin],
                ['Destino', !!cargo?.destination],
                ['Peso', (cargo?.weight ?? 0) > 0],
                ['Dimensões / Volumes', !!cargo?.dimensions?.length],
                ['Ready Date', !!cargo?.readyDate],
                ['ETA Máximo', !!cargo?.etaMaximo],
              ].map(([l, ok]) => (
                <View key={String(l)} style={s.confRow}>
                  <Text style={s.confLabel}>{l as string}</Text>
                  <Text style={[s.confOk, { color: ok ? GREEN : RED }]}>OK</Text>
                  <Text style={[s.confCheck, { color: ok ? GREEN : RED }]}>{ok ? '✓' : '✗'}</Text>
                </View>
              ))}
              <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: ok(cargo) ? GREEN_BG : '#fef2f2', padding: 4, borderRadius: 3, borderWidth: 1, borderColor: ok(cargo) ? GREEN : RED }}>
                <Text style={{ fontSize: 6, fontWeight: 'bold', color: ok(cargo) ? GREEN : RED }}>STATUS GLOBAL</Text>
                <Text style={{ fontSize: 6, fontWeight: 'bold', color: ok(cargo) ? GREEN : RED }}>{ok(cargo) ? 'CONFORME' : 'PENDENTE'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ════ AGENT TABLE ════ */}
        <View style={{ marginTop: 5 }}>
          <View style={s.tableTitle}><Text style={s.tableTitleText}>COTAÇÕES RECEBIDAS DOS AGENTES</Text></View>

          {/* Group header */}
          <View style={s.tGroupHdr}>
            <View style={{ width: s.cAgent.width + s.cModal.width }}><Text style={s.th}> </Text></View>
            <View style={{ flex: 1, borderLeftWidth: 0.5, borderLeftColor: '#2d6b82' }}>
              <Text style={s.th}>
                {hasCrossCurrency
                  ? '◄── BREAKDOWN DE CUSTOS (moeda original por linha — convertido p/ EUR no ranking) ──►'
                  : `◄── BREAKDOWN DE CUSTOS (${cur}) — cada componente separado ──►`}
              </Text>
            </View>
            <View style={{ width: 84, borderLeftWidth: 0.5, borderLeftColor: '#2d6b82' }}><Text style={s.th}>OPERAÇÃO</Text></View>
            <View style={{ width: 52, borderLeftWidth: 0.5, borderLeftColor: '#2d6b82' }}><Text style={s.th}>MARÍTIMO</Text></View>
            <View style={{ width: 44, borderLeftWidth: 0.5, borderLeftColor: '#2d6b82' }}><Text style={s.th}>DECISÃO</Text></View>
          </View>

          {/* Column header */}
          <View style={s.tColHdr}>
            <View style={s.cAgent}><Text style={s.thL}>Agente / Rota</Text></View>
            <View style={s.cModal}><Text style={s.th}>Modal</Text></View>
            <View style={s.cSm}><Text style={s.th}>Peso{'\n'}Ef.(kg)</Text></View>
            <View style={s.cRate}><Text style={s.th}>Taxa{'\n'}/kg</Text></View>
            <View style={s.cVal}><Text style={s.th}>Frete{'\n'}(P×T)</Text></View>
            <View style={s.cVal}><Text style={s.th}>Tx.{'\n'}Origem</Text></View>
            <View style={s.cVal}><Text style={s.th}>Tx.{'\n'}Destino</Text></View>
            <View style={s.cSm}><Text style={s.th}>Pickup</Text></View>
            <View style={s.cSm}><Text style={s.th}>Outros</Text></View>
            <View style={s.cTot}><Text style={[s.th, { color: '#7dd3fc' }]}>TOTAL{'\n'}GERAL</Text></View>
            <View style={s.cOp}><Text style={s.th}>Transit{'\n'}Time</Text></View>
            <View style={s.cOp}><Text style={s.th}>Rota</Text></View>
            <View style={s.cOp}><Text style={s.th}>ETD /\nValidade</Text></View>
            <View style={s.cSm}><Text style={s.th}>Free{'\n'}Time</Text></View>
            <View style={s.cSm}><Text style={s.th}>Dem./\nDet.</Text></View>
            <View style={{ width: 44 }}><Text style={s.th}>Decisão</Text></View>
          </View>

          {sorted.map((q, i) => {
            const d = q.extractedData;
            const total = getTotalCost(d);
            const isBest = q.ranking === 1;
            const effW = d.effectiveWeight ?? d.weight ?? null;
            const formula = d.ratePerKg && effW
              ? `${effW}kg × ${d.ratePerKg.toFixed(2)} = ${d.baseCost.toFixed(2)}`
              : null;
            const dec = getDecisionLabel(q, sorted);
            return (
              <View key={q.id}>
                <View style={isBest ? s.tRowBest : i % 2 === 0 ? s.tRow : s.tRowAlt}>
                  <View style={s.cAgent}>
                    <Text style={[s.tdL, isBest ? { fontWeight: 'bold', color: GOLD } : {}]}>{isBest ? '★ ' : ''}{d.agentName}</Text>
                    {d.carrier && (
                      <Text style={{ fontSize: 6.5, color: TEAL, fontWeight: 'bold', marginTop: 1.5 }}>
                        {d.carrier}
                      </Text>
                    )}
                  </View>
                  <View style={s.cModal}><Text style={s.td}>{d.modal}</Text></View>
                  <View style={s.cSm}>
                    <Text style={[s.td, d.rateMinWeight && effW && effW > (d.weight ?? 0) ? { color: '#1d4ed8', fontWeight: 'bold' } : {}]}>
                      {effW ? `${effW}${d.rateMinWeight ? `\n(+${d.rateMinWeight}K)` : ''}` : '-'}
                    </Text>
                  </View>
                  <View style={s.cRate}><Text style={s.td}>{d.ratePerKg ? d.ratePerKg.toFixed(2) : '-'}</Text></View>
                  <View style={s.cVal}>
                    <Text style={s.td}>{d.baseCost.toFixed(2)}</Text>
                    {formula && <Text style={{ fontSize: 4.5, color: GRAY, textAlign: 'center' }}>{formula}</Text>}
                  </View>
                  <View style={s.cVal}><Text style={s.td}>{d.originCharges ? d.originCharges.toFixed(2) : '-'}</Text></View>
                  <View style={s.cVal}><Text style={s.td}>{d.destinationCharges ? d.destinationCharges.toFixed(2) : '-'}</Text></View>
                  <View style={s.cSm}><Text style={s.td}>{d.pickupCost ? d.pickupCost.toFixed(2) : '-'}</Text></View>
                  <View style={s.cSm}><Text style={s.td}>{d.otherCharges ? d.otherCharges.toFixed(2) : '-'}</Text></View>
                  <View style={s.cTot}>
                    <Text style={[s.tdBold, { color: isBest ? GOLD : NAVY }]}>
                      {d.currency} {total.toFixed(2)}
                    </Text>
                    {d.exchangeRateToEur && d.currency !== 'EUR' && (
                      <Text style={{ fontSize: 5.5, color: '#1d4ed8', fontWeight: 'bold', textAlign: 'center', marginTop: 1 }}>
                        {'≈ EUR '}{(total * d.exchangeRateToEur).toFixed(2)}
                      </Text>
                    )}
                    {d.localChargesBRL && (
                      <Text style={{ fontSize: 5.5, color: '#16a34a', fontWeight: 'bold', marginTop: 1.5 }}>
                        + R$ {d.localChargesBRL.toFixed(2)}
                      </Text>
                    )}
                    {d.localChargesBRLDesc && (
                      <Text style={{ fontSize: 4.5, color: GRAY, marginTop: 0.5 }}>
                        {d.localChargesBRLDesc}
                      </Text>
                    )}
                  </View>
                  <View style={s.cOp}><Text style={s.td}>{d.transitTime ? (d.transitTimeMax && d.transitTimeMax !== d.transitTime ? `${d.transitTime}–${d.transitTimeMax}d` : `${d.transitTime}d`) : '-'}</Text></View>
                  <View style={s.cOp}><Text style={[s.td, d.modal === 'AEREO' && d.frequency ? { color: TEAL, fontWeight: 'bold', fontSize: 5.5 } : {}]}>{d.modal === 'AEREO' ? (d.frequency || '-') : '-'}</Text></View>
                  <View style={s.cOp}><Text style={s.td}>{getRoute(d.agentName)}</Text></View>
                  <View style={s.cOp}><Text style={s.td}>{d.etd ? formatDate(d.etd) : '-'}</Text></View>
                  <View style={s.cSm}><Text style={s.td}>{d.freeTime ? `${d.freeTime}d` : '-'}</Text></View>
                  <View style={s.cSm}><Text style={s.td}>-</Text></View>
                  <View style={{ width: 44, backgroundColor: dec.bg, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 5.5, fontWeight: 'bold', color: dec.color, textAlign: 'center' }}>{dec.label}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ════ BOTTOM ════ */}
        <View style={s.bottom}>
          {/* Critérios */}
          <View style={s.bCard}>
            <View style={s.bTitle}><Text style={s.bTitleText}>CRITÉRIOS DE PONDERAÇÃO DO SCORE</Text></View>
            <View style={s.bBody}>
              {[['Custo Total (peso)', '50%'], ['Transit Time (peso)', '30%'], ['Condições Operacionais (Free Time / Qualidade) (peso)', '20%']].map(([l, v]) => (
                <View key={l} style={s.bRow}><Text style={s.bLabel}>{l}</Text><Text style={s.bValue}>{v}</Text></View>
              ))}
              <View style={[s.bRow, { borderTopWidth: 0.5, borderTopColor: BORDER, marginTop: 3, paddingTop: 3 }]}>
                <Text style={[s.bLabel, { fontWeight: 'bold' }]}>TOTAL</Text>
                <Text style={[s.bValue, { color: TEAL }]}>100%</Text>
              </View>
            </View>
          </View>

          {/* Legenda */}
          <View style={s.bCard}>
            <View style={s.bTitle}><Text style={s.bTitleText}>LEGENDA SCORE OPERACIONAL</Text></View>
            <View style={s.bBody}>
              {[['#16a34a', GREEN_BG, '0,80 a 1,00', 'Excelente'], ['#ca8a04', '#fefce8', '0,60 a 0,79', 'Bom'], ['#ea580c', '#fff7ed', '0,40 a 0,59', 'Regular'], ['#dc2626', '#fef2f2', '0,00 a 0,39', 'Ruim']].map(([c, bg, r, l]) => (
                <View key={l} style={[s.legendRow, { backgroundColor: bg }]}>
                  <View style={[s.dot, { backgroundColor: c }]} />
                  <Text style={{ fontSize: 6, flex: 1, color: '#374151' }}>{r}</Text>
                  <Text style={{ fontSize: 6, fontWeight: 'bold', color: c }}>{l}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Resumo da Decisão */}
          {best && (
            <View style={s.decCard}>
              <View style={s.decTitle}><Text style={s.decTitleText}>RESUMO DA DECISÃO</Text></View>
              <View style={s.decBody}>
                {/* Melhor */}
                <View style={[s.decCol, { backgroundColor: WHITE, borderRadius: 3, padding: 5, borderWidth: 1, borderColor: '#f59e0b' }]}>
                  <Text style={[s.decColTitle, { color: GOLD }]}>MELHOR OPÇÃO (Ranking 1)</Text>
                  {[
                    ['Agente / Companhia:', best.extractedData.agentName.split(' - ')[0]],
                    ['Rota:', getRoute(best.extractedData.agentName)],
                    ['Total Geral:', `${best.extractedData.currency} ${getTotalCost(best.extractedData).toFixed(2)}`],
                    ...(best.extractedData.exchangeRateToEur && best.extractedData.currency !== 'EUR'
                      ? [['Equiv. EUR:', `EUR ${eurTotal(best).toFixed(2)} (tx: ${best.extractedData.exchangeRateToEur.toFixed(5)})`]]
                      : []),
                    ...(best.extractedData.localChargesBRL ? [['Taxas Brasil:', `R$ ${best.extractedData.localChargesBRL.toFixed(2)}`]] : []),
                    ['Transit Time:', best.extractedData.transitTime ? (best.extractedData.transitTimeMax && best.extractedData.transitTimeMax !== best.extractedData.transitTime ? `${best.extractedData.transitTime}–${best.extractedData.transitTimeMax} dias` : `${best.extractedData.transitTime} dias`) : '-'],
                    ['Score Operacional:', (best.score ?? 0).toFixed(2)],
                    ['Elegível:', 'SIM'],
                  ].map(([l, v]) => (
                    <View key={l} style={s.decRow}>
                      <Text style={s.decLabel}>{l}</Text>
                      <Text style={[s.decValue, l === 'Score Operacional:' ? { color: sc(best.score ?? 0) } : l === 'Elegível:' ? { color: GREEN } : l === 'Taxas Brasil:' ? { color: '#16a34a' } : {}]}>{v}</Text>
                    </View>
                  ))}
                  <View style={{ marginTop: 4, padding: 3, backgroundColor: GOLD_BG, borderRadius: 2, borderLeftWidth: 2, borderLeftColor: GOLD }}>
                    <Text style={{ fontSize: 5.5, color: '#92400e', fontWeight: 'bold' }}>JUSTIFICATIVA (Score 50% Custo · 30% Prazo · 20% Operacional):</Text>
                    <Text style={{ fontSize: 5.5, color: '#1e293b', marginTop: 2 }}>{generateJustification(best, sorted)}</Text>
                  </View>
                </View>
                {/* Segundo */}
                {second && (
                  <View style={[s.decCol, { backgroundColor: WHITE, borderRadius: 3, padding: 5, borderWidth: 0.5, borderColor: BORDER }]}>
                    <Text style={[s.decColTitle, { color: GRAY }]}>SEGUNDO LUGAR (Ranking 2)</Text>
                    {[
                      ['Agente / Companhia:', second.extractedData.agentName.split(' - ')[0]],
                      ['Rota:', getRoute(second.extractedData.agentName)],
                      ['Total Geral:', `${second.extractedData.currency} ${getTotalCost(second.extractedData).toFixed(2)}`],
                      ...(second.extractedData.exchangeRateToEur && second.extractedData.currency !== 'EUR'
                        ? [['Equiv. EUR:', `EUR ${eurTotal(second).toFixed(2)}`]]
                        : []),
                      ...(second.extractedData.localChargesBRL ? [['Taxas Brasil:', `R$ ${second.extractedData.localChargesBRL.toFixed(2)}`]] : []),
                      ['Transit Time:', second.extractedData.transitTime ? (second.extractedData.transitTimeMax && second.extractedData.transitTimeMax !== second.extractedData.transitTime ? `${second.extractedData.transitTime}–${second.extractedData.transitTimeMax} dias` : `${second.extractedData.transitTime} dias`) : '-'],
                      ['Score Operacional:', (second.score ?? 0).toFixed(2)],
                      ['Elegível:', 'SIM'],
                    ].map(([l, v]) => (
                      <View key={l} style={s.decRow}><Text style={s.decLabel}>{l}</Text><Text style={[s.decValue, l === 'Elegível:' ? { color: GREEN } : l === 'Taxas Brasil:' ? { color: '#16a34a' } : {}]}>{v}</Text></View>
                    ))}
                  </View>
                )}
                {/* Comparativo */}
                {second && (() => {
                  const b = hasCrossCurrency ? eurTotal(best) : getTotalCost(best.extractedData);
                  const s2 = hasCrossCurrency ? eurTotal(second) : getTotalCost(second.extractedData);
                  const compCur = hasCrossCurrency ? 'EUR' : cur;
                  const diff = Math.abs(b - s2);
                  const pct = ((diff / Math.max(b, s2)) * 100).toFixed(1);
                  return (
                    <View style={[s.decCol, { backgroundColor: WHITE, borderRadius: 3, padding: 5, borderWidth: 0.5, borderColor: BORDER }]}>
                      <Text style={s.decColTitle}>COMPARATIVO FINANCEIRO</Text>
                      {[
                        ['Melhor Opção:', `${compCur} ${b.toFixed(2)}`],
                        ['Segundo Lugar:', `${compCur} ${s2.toFixed(2)}`],
                        [`Diferença (${compCur}):`, `${compCur} ${diff.toFixed(2)}`],
                        ['Diferença (%):', `${pct}%`],
                        ...(hasCrossCurrency ? [['Base:', 'BCB PTAX']] : []),
                      ].map(([l, v]) => (
                        <View key={l} style={s.decRow}><Text style={s.decLabel}>{l}</Text><Text style={s.decValue}>{v}</Text></View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          {/* Ranking Final */}
          <View style={s.bCard}>
            <View style={s.bTitle}><Text style={s.bTitleText}>RANKING FINAL (Elegíveis)</Text></View>
            <View style={s.bBody}>
              <View style={[s.rankRow, { borderBottomWidth: 1, borderBottomColor: NAVY }]}>
                <Text style={[s.bLabel, { width: 22, fontWeight: 'bold' }]}>RANK</Text>
                <Text style={[s.bLabel, { flex: 1, fontWeight: 'bold' }]}>AGENTE</Text>
                <Text style={[s.bLabel, { width: 52, textAlign: 'right', fontWeight: 'bold' }]}>
                  {hasCrossCurrency ? 'TOTAL (EUR)' : `TOTAL (${cur})`}
                </Text>
                <Text style={[s.bLabel, { width: 26, textAlign: 'right', fontWeight: 'bold' }]}>SCORE</Text>
              </View>
              {sorted.slice(0, 7).map(q => {
                const qd = q.extractedData;
                const qTotal = getTotalCost(qd);
                const qEur = eurTotal(q);
                const isConverted = !!qd.exchangeRateToEur && qd.currency !== 'EUR';
                return (
                  <View key={q.id}>
                    <View style={[s.rankRow, q.ranking === 1 ? { backgroundColor: GOLD_BG } : {}]}>
                      <Text style={[s.bLabel, { width: 22, color: q.ranking === 1 ? GOLD : GRAY }]}>#{q.ranking}</Text>
                      <Text style={[s.bLabel, { flex: 1 }]}>{qd.agentName.split(' - ')[0].slice(0, 16)}</Text>
                      <View style={{ width: 52, alignItems: 'flex-end' }}>
                        <Text style={[s.bValue, { fontSize: 6 }]}>
                          {hasCrossCurrency ? `EUR ${qEur.toFixed(2)}` : qTotal.toFixed(2)}
                        </Text>
                        {isConverted && (
                          <Text style={{ fontSize: 4.5, color: GRAY }}>{qd.currency} {qTotal.toFixed(2)}</Text>
                        )}
                      </View>
                      <Text style={[s.bValue, { width: 26, textAlign: 'right', fontSize: 6, color: sc(q.score ?? 0) }]}>{(q.score ?? 0).toFixed(2)}</Text>
                    </View>
                    {qd.localChargesBRL && (
                      <View style={[s.rankRow, { backgroundColor: '#f0fdf4', paddingLeft: 30 }]}>
                        <Text style={[s.bLabel, { flex: 1, fontSize: 5.5, color: '#16a34a' }]}>+ Taxas BRL:</Text>
                        <Text style={[s.bValue, { width: 52, textAlign: 'right', fontSize: 5.5, color: '#16a34a' }]}>R$ {qd.localChargesBRL.toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footText}>Brasporto International Logistics — Relatório gerado automaticamente</Text>
          <Text style={s.footText}>{date}</Text>
        </View>

      </Page>
    </Document>
  );
}

// helper
function ok(cargo?: CargoDetails) {
  return !!(cargo?.origin && cargo?.destination && cargo?.weight);
}
