'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, query, orderBy, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quotation } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { getTotalCost } from '@/lib/scoring';
import { Upload, Clock, Loader2, Eye, Trophy } from 'lucide-react';

// Data como ms (suporta Firestore Timestamp e Date)
function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  return new Date(val).getTime();
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<'home' | 'historico'>('home');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  // Limpar expiradas
  useEffect(() => {
    getDocs(query(collection(db, 'quotations')))
      .then(snap => {
        const now = new Date();
        snap.forEach(d => {
          const exp = d.data().expiresAt;
          const expDate = exp?.toDate ? exp.toDate() : new Date(exp);
          if (expDate <= now) deleteDoc(d.ref);
        });
      });
  }, []);

  // Carregar histórico (todos os usuários)
  useEffect(() => {
    const q = query(
      collection(db, 'quotations'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => {
      const docs: Quotation[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() } as Quotation));
      setQuotations(docs);
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-[#4A9BAA] animate-spin" />
      </div>
    );
  }

  const modalColors: Record<string, string> = {
    AEREO: 'bg-purple-100 text-purple-700',
    FCL: 'bg-blue-100 text-blue-700',
    LCL: 'bg-green-100 text-green-700',
  };

  // Agrupa as cotações por solicitação (sessionRef). Cada grupo = 1 análise
  // com vários agentes; o "vencedor" é o ranking #1 (fallback: menor custo).
  const sessions = (() => {
    const map = new Map<string, Quotation[]>();
    for (const q of quotations) {
      const ref = q.sessionRef?.trim();
      const key = ref ? `ref:${ref}` : `id:${q.id}`;
      const arr = map.get(key) ?? [];
      arr.push(q);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, arr]) => {
        const winner = [...arr].sort((a, b) => (a.ranking ?? 99) - (b.ranking ?? 99))[0];
        const latestMs = arr.reduce((m, q) => Math.max(m, toMs(q.createdAt)), 0);
        return { key, sessionRef: winner.sessionRef?.trim() || '', createdAt: winner.createdAt, latestMs, count: arr.length, winner };
      })
      .sort((a, b) => b.latestMs - a.latestMs);
  })();

  // ── HISTÓRICO ──────────────────────────────────────────────────────────────
  if (view === 'historico') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Histórico de Cotações</h1>
            <p className="text-sm text-gray-500 mt-0.5">{sessions.length} cotaç{sessions.length === 1 ? 'ão' : 'ões'} registrada{sessions.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setView('home')} className="text-sm text-gray-500 hover:text-gray-700">
              ← Voltar
            </button>
            <button
              onClick={() => router.push('/upload')}
              className="flex items-center gap-2 px-4 py-2 bg-[#4A9BAA] hover:bg-[#3d8594] text-white rounded-lg text-sm font-medium transition"
            >
              <Upload className="w-4 h-4" /> Nova Cotação
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="w-6 h-6 text-[#4A9BAA] animate-spin mx-auto" /></div>
          ) : quotations.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma cotação no histórico.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Agentes</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nº Cotação</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Melhor Opção</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Modal</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Menor Custo</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const w = s.winner;
                  const total = getTotalCost(w.extractedData);
                  return (
                    <tr key={s.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-500">{s.count} agente{s.count === 1 ? '' : 's'}</span>
                      </td>
                      <td className="px-5 py-3">
                        {s.sessionRef
                          ? <span className="font-mono text-xs text-[#4A9BAA] font-semibold">{s.sessionRef}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{formatDate(s.createdAt)}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          {w.extractedData.agentName}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${modalColors[w.extractedData.modal] ?? 'bg-gray-100 text-gray-600'}`}>
                          {w.extractedData.modal}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {total.toFixed(2)} <span className="text-xs text-gray-400">{w.extractedData.currency}</span>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => router.push(`/dashboard/${w.id}`)} className="text-[#4A9BAA] hover:text-[#3d8594] flex items-center gap-1 text-xs font-medium">
                          <Eye className="w-3.5 h-3.5" /> Ver ranking
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ── HOME ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 72px)' }}>
      <div className="w-full max-w-2xl text-center">

        <div className="mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(74,155,170,0.12)', color: '#4A9BAA' }}>
            <span>✦</span> Plataforma de Cotação de Fretes
          </div>
        </div>

        <h1 className="text-3xl font-semibold text-gray-900 mb-3">
          Bem-vindo, <span style={{ color: '#003d4d' }} className="capitalize">{user?.email?.split('@')[0]}</span>
        </h1>
        <p className="text-gray-500 mb-10 leading-relaxed text-sm">
          Inicie um novo processo de cotação ou consulte o histórico de cotações realizadas.
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-4 transition-all hover:border-[#4A9BAA] hover:bg-[#f0f9fb]">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(74,155,170,0.1)' }}>
              <Upload className="w-7 h-7" style={{ color: '#4A9BAA' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Nova Cotação</h2>
              <p className="text-sm text-gray-500">Faça o upload dos documentos de embarque e obtenha o ranking de agentes.</p>
            </div>
            <button
              onClick={() => router.push('/upload')}
              className="w-full py-2.5 text-white rounded-xl font-medium transition text-sm"
              style={{ background: '#4A9BAA' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3d8594'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#4A9BAA'; }}
            >
              Começar Agora
            </button>
          </div>

          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-4 transition-all hover:border-[#4A9BAA] hover:bg-[#f0f9fb]">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(74,155,170,0.08)' }}>
              <Clock className="w-7 h-7" style={{ color: '#4A9BAA' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Histórico</h2>
              <p className="text-sm text-gray-500">Consulte cotações anteriores, rankings e relatórios de processos encerrados.</p>
            </div>
            <button
              onClick={() => setView('historico')}
              className="w-full py-2.5 text-white rounded-xl font-medium transition text-sm"
              style={{ background: '#4A9BAA' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3d8594'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#4A9BAA'; }}
            >
              Acessar Histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
