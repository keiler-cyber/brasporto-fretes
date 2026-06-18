'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { AlertCircle, Eye, EyeOff, ArrowRight, Loader2, Shield } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Redirecionar direto ao dashboard se já logado
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!email.endsWith('@brasporto.com')) throw new Error('Apenas emails @brasporto.com são permitidos');
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/user-not-found': 'Email não encontrado',
        'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde',
      };
      setError(msgs[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!email.endsWith('@brasporto.com')) throw new Error('Apenas emails @brasporto.com são permitidos');
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push('/dashboard');
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/email-already-in-use': 'Este email já está registrado',
        'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres',
        'auth/user-not-found': 'Email não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/invalid-credential': 'Email ou senha incorretos',
        'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde',
      };
      setError(msgs[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Enquanto verifica auth, mostrar spinner mínimo
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 text-[#4A9BAA] animate-spin" />
      </div>
    );
  }

  // Se já logado, não renderizar nada (useEffect vai redirecionar)
  if (user) return null;

  return (
    <div className="min-h-screen flex">

      {/* ── LADO ESQUERDO ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img
          src="/port-bg.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#001f2b]/90 via-[#003d4d]/80 to-[#001f2b]/70" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <p className="text-3xl font-black tracking-widest text-white leading-none">BRASPORTO</p>
            <p className="text-xs tracking-[0.25em] text-white/70 uppercase mt-1 font-medium">International Logistics</p>
          </div>

          <div>
            <div className="w-10 h-1 bg-[#e8a020] mb-6 rounded" />
            <h1 className="text-5xl font-black text-white leading-tight mb-4">
              Comparador<br />inteligente<br />de fretes
            </h1>
            <p className="text-[#7dd3e8] text-lg leading-relaxed max-w-sm">
              Air, FCL e LCL — validação operacional, ranking automático, decisão em segundos.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs">
              © {new Date().getFullYear()} Brasporto International Logistics
            </p>
            <span className="px-2.5 py-1 bg-[#4A9BAA] text-white text-xs font-bold font-mono rounded-full tracking-widest shadow">
              v26.06.18
            </span>
          </div>
        </div>
      </div>

      {/* ── LADO DIREITO — formulário ────────────────────────────────────── */}
      <div className="flex-1 lg:max-w-[480px] flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <p className="text-2xl font-black tracking-widest text-[#003d4d]">BRASPORTO</p>
            <p className="text-[10px] tracking-[0.2em] text-gray-400 uppercase">International Logistics</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {isReset ? 'Recuperar Senha' : isSignup ? 'Criar Acesso' : 'Acesso à Plataforma'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isReset
                ? 'Informe seu email para receber o link de redefinição'
                : isSignup
                  ? 'Crie sua senha para acessar a plataforma'
                  : 'Entre com suas credenciais para continuar'}
            </p>
          </div>

          {/* Formulário de recuperação */}
          {isReset && (
            <div className="space-y-5">
              {resetSent ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-700 font-semibold text-sm mb-1">Email enviado!</p>
                  <p className="text-green-600 text-xs">
                    Verifique sua caixa de entrada em <strong>{email}</strong> e siga as instruções.
                  </p>
                  <button
                    onClick={() => { setIsReset(false); setResetSent(false); setError(''); }}
                    className="mt-4 text-sm text-[#4A9BAA] hover:underline"
                  >
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail</label>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="seu-email@brasporto.com" required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4A9BAA] transition placeholder:text-gray-300"
                    />
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}
                  <button type="submit" disabled={loading}
                    className="w-full py-3.5 bg-[#4A9BAA] hover:bg-[#3d8594] disabled:bg-gray-300 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm">
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</>
                      : <>Enviar link de recuperação <ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <button type="button" onClick={() => { setIsReset(false); setError(''); }}
                    className="w-full text-sm text-gray-500 hover:text-[#4A9BAA] transition">
                    ← Voltar ao login
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Formulário de login / cadastro */}
          {!isReset && (
            <form onSubmit={handleAuth} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu-email@brasporto.com" required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4A9BAA] transition placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#4A9BAA] transition placeholder:text-gray-300"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {isSignup && (
                  <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres.</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 bg-[#4A9BAA] hover:bg-[#3d8594] disabled:bg-gray-300 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{isSignup ? 'Criando...' : 'Entrando...'}</>
                  : <>{isSignup ? 'Criar Senha e Entrar' : 'Entrar'} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* Links auxiliares */}
          {!isReset && (
            <div className="mt-5 space-y-2 text-center">
              <button
                onClick={() => { setIsSignup(!isSignup); setError(''); }}
                className="block w-full text-sm text-gray-500 hover:text-[#4A9BAA] transition"
              >
                {isSignup ? 'Já tem conta? Entrar' : 'Não tem conta? Criar acesso'}
              </button>
              {!isSignup && (
                <button
                  onClick={() => { setIsReset(true); setError(''); setResetSent(false); }}
                  className="block w-full text-sm text-gray-400 hover:text-[#4A9BAA] transition"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-2 text-gray-400">
            <Shield className="w-4 h-4" />
            <p className="text-xs">Acesso restrito a colaboradores @brasporto.com</p>
          </div>

        </div>
      </div>

    </div>
  );
}
