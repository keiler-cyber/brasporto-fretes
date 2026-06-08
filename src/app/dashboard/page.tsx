'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, query, where, orderBy, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quotation } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import Image from 'next/image';
import { Upload, Clock, Loader2, Eye, Trophy, Award, Star } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<'home' | 'historico'>('home');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
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

  function RankIcon({ r }: { r?: number }) {
    if (r === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (r === 2) return <Award className="w-4 h-4 text-gray-400" />;
    if (r === 3) return <Award className="w-4 h-4 text-amber-600" />;
    return <Star className="w-3 h-3 text-gray-300" />;
  }

  // ── HISTÓRICO ──────────────────────────────────────────────────────────────
  if (view === 'historico') {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Histórico de Cotações</h1>
            <p className="text-sm text-gray-500 mt-0.5">{quotations.length} cotações registradas</p>
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
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pos.</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Agente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Modal</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Custo Total</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => {
                  const total = q.extractedData.baseCost + (q.extractedData.pickupCost || 0) + (q.extractedData.originCharges || 0) + (q.extractedData.destinationCharges || 0) + (q.extractedData.otherCharges || 0);
                  return (
                    <tr key={q.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition ${q.ranking === 1 ? 'bg-yellow-50/30' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <RankIcon r={q.ranking} />
                          <span className="text-xs text-gray-500">#{q.ranking ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{formatDate(q.createdAt)}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{q.extractedData.agentName}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${modalColors[q.extractedData.modal] ?? 'bg-gray-100 text-gray-600'}`}>
                          {q.extractedData.modal}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {total.toFixed(2)} <span className="text-xs text-gray-400">{q.extractedData.currency}</span>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => router.push(`/dashboard/${q.id}`)} className="text-[#4A9BAA] hover:text-[#3d8594] flex items-center gap-1 text-xs font-medium">
                          <Eye className="w-3.5 h-3.5" /> Ver
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
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-2xl px-6 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/brasporto-logo.png"
            alt="Brasporto International Logistics"
            width={280}
            height={98}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">Bem-vindo ao Brasporto Fretes</h1>
        <p className="text-gray-500 mb-10 leading-relaxed">
          Inicie um novo processo de cotação de fretes de forma rápida e centralizada. Faça o<br />
          upload dos documentos e nós cuidamos do resto.
        </p>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-6">
          {/* Nova Cotação */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-sm hover:shadow-md transition">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <Upload className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Nova Cotação</h2>
              <p className="text-sm text-gray-500">Inicie um novo pedido de cotação fazendo o upload de seus documentos de embarque.</p>
            </div>
            <button
              onClick={() => router.push('/upload')}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition text-sm"
            >
              Começar Agora
            </button>
          </div>

          {/* Histórico */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-sm hover:shadow-md transition">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Histórico</h2>
              <p className="text-sm text-gray-500">Consulte o arquivo de pedidos e cotações realizadas anteriormente no sistema.</p>
            </div>
            <button
              onClick={() => setView('historico')}
              className="w-full py-2.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition text-sm"
            >
              Acessar Histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
