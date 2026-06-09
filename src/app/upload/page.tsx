'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CargoDetails, ExtractionData, Quotation } from '@/lib/types';
import { calculateScoring, getRanking, getScoreByIndex } from '@/lib/scoring';
import { PDFUpload } from '@/components/PDFUpload';
import { CargoReview } from '@/components/CargoReview';
import { ReviewExtraction } from '@/components/ReviewExtraction';
import { RankingDisplay } from '@/components/RankingDisplay';
import { ReportPDF } from '@/components/ReportPDF';
import { BrasportoLogo } from '@/components/BrasportoLogo';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Loader2, AlertCircle, ArrowLeft, Mail, FileText, CheckSquare, BarChart2, Trophy } from 'lucide-react';

type Step = 'request' | 'review-request' | 'quotes' | 'review-quotes' | 'ranking' | 'report';

const STEPS = [
  { id: 'request',        label: '1. SOLICITAÇÃO\nDO CLIENTE',       icon: Mail },
  { id: 'review-request', label: '2. CONFERÊNCIA\nLOGÍSTICA',        icon: FileText },
  { id: 'quotes',         label: '3. COTAÇÕES\nDOS AGENTES',         icon: FileText },
  { id: 'review-quotes',  label: '4. VALIDAÇÃO E\nCOMPARAÇÃO',       icon: CheckSquare },
  { id: 'ranking',        label: '5. DECISÃO',                        icon: Trophy },
];

function ProgressBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                active ? 'border-[#4A9BAA] bg-[#4A9BAA] text-white' :
                done ? 'border-[#4A9BAA] bg-[#4A9BAA] text-white' :
                'border-gray-200 bg-white text-gray-300'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className={`text-center text-[9px] font-semibold mt-1 whitespace-pre-line leading-tight ${
                active ? 'text-[#4A9BAA]' : done ? 'text-[#4A9BAA]' : 'text-gray-300'
              }`}>{s.label}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 ${done ? 'bg-[#4A9BAA]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>('request');
  const [cargo, setCargo] = useState<CargoDetails | null>(null);
  const [quotations, setQuotations] = useState<ExtractionData[]>([]);
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractingRequest, setExtractingRequest] = useState(false);

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#4A9BAA] animate-spin" />
    </div>
  );
  if (!user) { router.push('/login'); return null; }

  // ─── Step 1: Upload do pedido do cliente ───────────────────────────────────
  const handleRequestUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setError('');
    setExtractingRequest(true);
    try {
      const file = files[0];
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      const base64 = await convertFileToBase64(file);

      let res: Response;
      if (ext === '.eml' || ext === '.msg') {
        res = await fetch('/api/extract-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: base64, fileType: ext === '.msg' ? 'msg' : 'eml' }),
        });
      } else {
        res = await fetch('/api/extract-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao extrair pedido');
      setCargo(data as CargoDetails);
      setStep('review-request');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExtractingRequest(false);
    }
  };

  // ─── Step 3: Upload das cotações dos agentes ───────────────────────────────
  const handleQuotesUploaded = (results: { file: File; extractedData: ExtractionData }[]) => {
    setQuoteFiles(results.map(r => r.file));
    setQuotations(results.map(r => r.extractedData));
    setError('');
    setStep('review-quotes');
  };

  // ─── Step 4: Confirmar e calcular ranking ──────────────────────────────────
  const handleConfirm = async () => {
    if (quotations.length === 0 || !user) return;
    setLoading(true);
    try {
      const scores = calculateScoring(quotations);
      const ranking = getRanking(scores);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);

      // ranking é array de índices ordenados do melhor para o pior
      const positionOf = (idx: number) => ranking.indexOf(idx) + 1;

      const updated: Quotation[] = quotations.map((q, idx) => ({
        id: crypto.randomUUID?.() || `tmp-${Date.now()}-${idx}`,
        userId: user.uid,
        createdAt: new Date(),
        expiresAt,
        originalFileName: quoteFiles[idx]?.name || '',
        pdfUrl: '',
        extractedData: q,
        score: getScoreByIndex(idx, scores),
        ranking: positionOf(idx),
        status: 'RANKED',
      }));

      setAllQuotations(updated);

      await Promise.all(updated.map(q => addDoc(collection(db, 'quotations'), {
        userId: q.userId,
        createdAt: serverTimestamp(),
        expiresAt: q.expiresAt,
        originalFileName: q.originalFileName,
        extractedData: q.extractedData,
        score: q.score,
        ranking: q.ranking,
        status: q.status,
      })));

      setStep('ranking');
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <BrasportoLogo size="sm" />
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-600 font-medium">Upload de Documentos</span>
          <span className="text-xs text-gray-400 ml-1">Siga as etapas para registrar o pedido e as cotações concorrentes.</span>
          <div className="ml-auto flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              ← Dashboard
            </button>
            <button onClick={() => router.push('/login')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              ← Login
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <ProgressBar current={step} />

          {/* Error */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">Erro</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* ── STEP 1: Upload do pedido ── */}
          {step === 'request' && (
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-gray-900">Upload do Pedido (Load Request)</h2>
                <p className="text-sm text-gray-500 mt-1">Arraste um PDF ou clique para buscar em seu computador.</p>
              </div>
              <RequestDropzone
                loading={extractingRequest}
                onFile={handleRequestUpload}
                error={error}
              />
            </div>
          )}

          {/* ── STEP 2: Revisar dados do pedido ── */}
          {step === 'review-request' && cargo && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900">Revise os dados do Pedido</h2>
                <p className="text-sm text-gray-500 mt-1">Confirme ou altere os dados extraídos antes de prosseguir.</p>
              </div>
              <CargoReview data={cargo} onChange={setCargo} />
              <div className="flex gap-3 mt-8">
                <button onClick={() => setStep('request')} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm font-medium">
                  Voltar
                </button>
                <button
                  onClick={() => setStep('quotes')}
                  disabled={!cargo.origin || !cargo.destination || (!cargo.weight && !cargo.containerType)}
                  className="flex-1 px-4 py-3 bg-[#4A9BAA] hover:bg-[#3d8594] disabled:bg-gray-300 text-white rounded-xl transition text-sm font-medium flex items-center justify-center gap-2"
                >
                  Salvar Pedido e Avançar →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Upload cotações dos agentes ── */}
          {step === 'quotes' && (
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-gray-900">Upload de Cotações</h2>
                <p className="text-sm text-gray-500 mt-1">Arraste os PDFs das cotações concorrentes ou clique para selecioná-los.</p>
              </div>
              <PDFUpload
                onUploadComplete={handleQuotesUploaded}
                onError={setError}
                cargo={cargo}
                buttonLabel="Selecionar Arquivos (PDF, EML, MSG)"
              />
              <button onClick={() => setStep('review-request')} className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600">
                ← Voltar
              </button>
            </div>
          )}

          {/* ── STEP 4: Revisar cotações ── */}
          {step === 'review-quotes' && quotations.length > 0 && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900">Revisar Cotações e Coerência</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Verifique as cotações extraídas antes de salvar. {quotations.length} cotação(ões) extraída(s).
                </p>
              </div>
              <div className="space-y-4">
                {quotations.map((q, idx) => (
                  <ReviewExtraction
                    key={`${idx}`}
                    data={q}
                    fileName={quoteFiles[idx]?.name || `Arquivo ${idx + 1}`}
                    showActions={false}
                    onDataChange={updated =>
                      setQuotations(prev => prev.map((item, i) => i === idx ? updated : item))
                    }
                  />
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setStep('quotes')} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm font-medium">
                  Voltar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading || quotations.some(q => !q.agentName || !q.modal || !q.baseCost)}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl transition text-sm font-medium flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</> : 'Confirmar e Salvar →'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: Ranking ── */}
          {step === 'ranking' && (
            <RankingDisplay
              quotations={allQuotations}
              onGenerateReport={() => setStep('report')}
              loading={loading}
            />
          )}

          {/* ── STEP 6: Relatório ── */}
          {step === 'report' && allQuotations.length > 0 && (
            <div className="text-center space-y-6">
              <div>
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900">Relatório Pronto</h2>
                <p className="text-gray-500 text-sm mt-1">Baixe o comparativo completo em PDF</p>
              </div>
              <div className="flex gap-4 max-w-md mx-auto">
                <PDFDownloadLink
                  document={<ReportPDF quotations={allQuotations} cargo={cargo ?? undefined} />}
                  fileName={`brasporto-cotacoes-${new Date().toISOString().split('T')[0]}.pdf`}
                  className="flex-1 px-6 py-3 bg-[#4A9BAA] hover:bg-[#3d8594] text-white rounded-xl transition font-medium text-sm flex items-center justify-center"
                >
                  {({ loading: l }) => l ? 'Gerando PDF...' : '⬇ Baixar Relatório PDF'}
                </PDFDownloadLink>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition font-medium text-sm"
                >
                  Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Dropzone simples para o pedido ──────────────────────────────────────────
function RequestDropzone({ loading, onFile, error }: { loading: boolean; onFile: (f: File[]) => void; error: string }) {
  const [drag, setDrag] = useState(false);
  const ref = useState<HTMLInputElement | null>(null);

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = Array.from(e.dataTransfer.files).filter(f => { const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.')); return ['.pdf','.eml','.msg'].includes(ext); }); if (f.length) onFile(f); }}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${drag ? 'border-[#4A9BAA] bg-[#f0f9fb]' : 'border-gray-200 bg-gray-50 hover:border-[#4A9BAA]'} ${loading ? 'opacity-60 pointer-events-none' : ''}`}
        onClick={() => document.getElementById('request-file-input')?.click()}
      >
        <input id="request-file-input" type="file" accept=".pdf,.eml,.msg" className="hidden"
          onChange={e => { const f = Array.from(e.target.files || []); if (f.length) onFile(f); }} />
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-10 h-10 text-[#4A9BAA] animate-spin" />
            <p className="text-gray-600 font-medium">Extraindo dados do pedido...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#4A9BAA]/10 flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#4A9BAA]" />
            </div>
            <p className="text-gray-700 font-medium">Upload do Pedido (Load Request)</p>
            <p className="text-sm text-gray-400">Arraste e solte aqui — PDF, email EML ou MSG do Outlook.</p>
            <button className="mt-2 px-6 py-2.5 bg-[#4A9BAA] text-white rounded-lg text-sm font-medium hover:bg-[#3d8594] transition">
              Selecionar Arquivo (PDF, EML, MSG)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
