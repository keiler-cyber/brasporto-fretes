'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quotation } from '@/lib/types';
import { getTotalCost } from '@/lib/scoring';
import { volumetricWeightFromVolume, billedWeight } from '@/lib/volumetric';
import { ArrowLeft, Trophy, Award, Star, Loader2, AlertCircle, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReportPDF } from '@/components/ReportPDF';

function RankingBadge({ ranking }: { ranking?: number }) {
  if (!ranking) return null;
  if (ranking === 1)
    return (
      <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
        <Trophy className="w-3 h-3" /> #1 Melhor Opção
      </span>
    );
  if (ranking === 2)
    return (
      <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
        <Award className="w-3 h-3" /> #2
      </span>
    );
  if (ranking === 3)
    return (
      <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
        <Award className="w-3 h-3" /> #3
      </span>
    );
  return (
    <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">
      <Star className="w-3 h-3" /> #{ranking}
    </span>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

// Retorna a data como timestamp em ms (suporta Firestore Timestamp e Date)
function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  return new Date(val).getTime();
}

export default function QuotationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [sessionQuotations, setSessionQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !params.id) return;

    const fetchAll = async () => {
      try {
        // 1. Carregar a cotação principal
        const ref = doc(db, 'quotations', params.id as string);
        const snap = await getDoc(ref);
        if (!snap.exists()) { setError('Cotação não encontrada.'); return; }

        const main = { id: snap.id, ...snap.data() } as Quotation;
        setQuotation(main);

        // 2. Buscar todas as cotações e filtrar as do mesmo lote (±10 min)
        const allSnap = await getDocs(query(collection(db, 'quotations'), orderBy('createdAt', 'asc')));
        const mainMs = toMs(snap.data().createdAt);
        const WINDOW_MS = 10 * 60 * 1000; // 10 minutos

        const session: Quotation[] = [];
        allSnap.forEach(d => {
          const ms = toMs(d.data().createdAt);
          if (Math.abs(ms - mainMs) <= WINDOW_MS) {
            session.push({ id: d.id, ...d.data() } as Quotation);
          }
        });

        // Ordenar pelo ranking
        session.sort((a, b) => (a.ranking ?? 99) - (b.ranking ?? 99));
        setSessionQuotations(session);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar cotação.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user, params.id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4A9BAA] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-sm">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-[#4A9BAA] text-white rounded-lg hover:bg-[#3d8594] transition">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!quotation) return null;

  const d = quotation.extractedData;
  const totalCost = getTotalCost(d);
  const cubedWeight = d.measurement ? volumetricWeightFromVolume(d.measurement) : 0;
  const billed = billedWeight(d.weight, d.measurement);

  const modalColors: Record<string, string> = {
    AEREO: 'bg-purple-100 text-purple-800',
    FCL: 'bg-blue-100 text-blue-800',
    LCL: 'bg-green-100 text-green-800',
  };

  const pdfName = `brasporto-cotacoes-${new Date(toMs(quotation.createdAt)).toISOString().split('T')[0]}.pdf`;
  // Usar o lote completo se disponível, senão só esta cotação
  const pdfQuotations = sessionQuotations.length > 0 ? sessionQuotations : [quotation];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
            <ArrowLeft className="w-5 h-5" />
            Dashboard
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Detalhes da Cotação</h1>
            <p className="text-xs text-gray-500">{quotation.originalFileName}</p>
          </div>
          {/* Botão de download do relatório PDF */}
          <PDFDownloadLink
            document={<ReportPDF quotations={pdfQuotations} />}
            fileName={pdfName}
            className="flex items-center gap-2 px-4 py-2 bg-[#003d4d] hover:bg-[#004d60] text-white rounded-lg text-sm font-semibold transition"
          >
            {({ loading: l }) => l
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              : <><Download className="w-4 h-4" /> Baixar Relatório ({pdfQuotations.length} cotaç{pdfQuotations.length === 1 ? 'ão' : 'ões'})</>
            }
          </PDFDownloadLink>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Lote da análise */}
        {sessionQuotations.length > 1 && (
          <div className="bg-[#f0f9fb] border border-[#4A9BAA]/30 rounded-xl px-5 py-3 flex items-center justify-between">
            <p className="text-sm text-[#003d4d] font-medium">
              Esta cotação faz parte de uma análise com <strong>{sessionQuotations.length} cotações</strong>.
            </p>
            <div className="flex gap-1.5">
              {sessionQuotations.map(q => (
                <button
                  key={q.id}
                  onClick={() => router.push(`/dashboard/${q.id}`)}
                  className={`px-2 py-0.5 rounded-full text-xs font-bold transition ${
                    q.id === quotation.id
                      ? 'bg-[#4A9BAA] text-white'
                      : 'bg-white border border-[#4A9BAA] text-[#4A9BAA] hover:bg-[#f0f9fb]'
                  }`}
                >
                  #{q.ranking} {q.extractedData.agentName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cabeçalho da cotação */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RankingBadge ranking={quotation.ranking} />
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${modalColors[d.modal] ?? 'bg-gray-100 text-gray-700'}`}>
                  {d.modal}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{d.agentName}</h2>
              {d.carrier && <p className="text-sm text-[#4A9BAA] font-medium mt-0.5">{d.carrier}</p>}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">{(quotation.score ?? 0).toFixed(3)}</p>
              <p className="text-xs text-gray-500">pontuação</p>
            </div>
          </div>
          <div className="text-xs text-gray-400 flex gap-4">
            <span>Criado em {formatDate(quotation.createdAt)}</span>
            <span>Expira em {formatDate(quotation.expiresAt)}</span>
          </div>
        </div>

        {/* Custos */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Custos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Frete Base" value={`${d.baseCost.toFixed(2)} ${d.currency}`} />
            <Field label="Incoterm" value={d.incoterm} />
            <Field label="Moeda" value={d.currency} />
            <Field label="Pickup" value={d.pickupCost ? `${d.pickupCost.toFixed(2)} ${d.currency}` : null} />
            <Field label="Taxas Origem" value={d.originCharges ? `${d.originCharges.toFixed(2)} ${d.currency}` : null} />
            <Field label="Taxas Destino" value={d.destinationCharges ? `${d.destinationCharges.toFixed(2)} ${d.currency}` : null} />
            <Field label="Outras Despesas" value={d.otherCharges ? `${d.otherCharges.toFixed(2)} ${d.currency}` : null} />
            {d.customsCharges ? <Field label="Customs (% mercadoria)" value={`${d.customsCharges.toFixed(2)} ${d.currency}`} /> : null}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Custo Total</span>
              <span className="text-lg font-bold text-gray-900">{totalCost.toFixed(2)} {d.currency}</span>
            </div>
            {d.localChargesBRL && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-green-700">{d.localChargesBRLDesc || 'Taxas no Brasil'}</span>
                <span className="text-sm font-semibold text-green-700">+ R$ {d.localChargesBRL.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Logística */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Logística</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Transit Time" value={d.transitTime ? (d.transitTimeMax && d.transitTimeMax !== d.transitTime ? `${d.transitTime}–${d.transitTimeMax} dias` : `${d.transitTime} dias`) : null} />
            <Field label="ETD" value={d.etd ? formatDate(d.etd) : null} />
            <Field label="Free Time" value={d.freeTime ? `${d.freeTime} dias` : null} />
            <Field label="Modal" value={d.modal} />
            {d.frequency && <Field label="Frequência" value={d.frequency} />}
          </div>
        </div>

        {/* Peso / Cubagem */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Peso & Cubagem</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Peso Bruto" value={d.weight ? `${d.weight} kg` : null} />
            <Field label="Volume" value={d.measurement ? `${d.measurement} m³` : null} />
            {d.modal === 'AEREO' && (
              <>
                <Field label="Peso Cubado" value={cubedWeight ? `${cubedWeight.toFixed(2)} kg` : null} />
                <Field label="Peso Taxado" value={billed ? `${billed.toFixed(2)} kg` : null} />
                {d.ratePerKg && <Field label="Taxa/kg" value={`${d.ratePerKg.toFixed(2)} ${d.currency}`} />}
                {d.effectiveWeight && <Field label="Peso Efetivo (break)" value={`${d.effectiveWeight} kg`} />}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
