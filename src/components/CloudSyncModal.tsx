import React, { useState } from 'react';
import {
  Cloud,
  X,
  CheckCircle2,
  RefreshCw,
  LogIn,
  LogOut,
  UserPlus,
  AlertCircle,
  Smartphone,
  Laptop,
} from 'lucide-react';
import {
  CloudUser,
  getCloudUser,
  cloudLogin,
  cloudRegister,
  cloudLogout,
} from '../services/cloudSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  lightMode: boolean;
  currentUser: CloudUser | null;
  isSyncing: boolean;
  lastSyncedTime: number | null;
  onPerformSync: () => Promise<void>;
  onUserChanged: (user: CloudUser | null) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  lightMode,
  currentUser,
  isSyncing,
  lastSyncedTime,
  onPerformSync,
  onUserChanged,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === 'register') {
        const user = await cloudRegister(email, password);
        onUserChanged(user);
        setSuccessMsg('Conta criada com sucesso! Sincronizando dados...');
        await onPerformSync();
      } else {
        const user = await cloudLogin(email, password);
        onUserChanged(user);
        setSuccessMsg('Login realizado com sucesso! Sincronizando dados...');
        await onPerformSync();
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    cloudLogout();
    onUserChanged(null);
    setSuccessMsg('Você saiu da conta com sucesso.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const formatLastSync = (ts: number | null) => {
    if (!ts) return 'Ainda não sincronizado nesta sessão';
    const date = new Date(ts);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            lightMode ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/80'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Cloud className="w-5 h-5" />
            </span>
            <div>
              <h2
                className={`text-base font-bold ${
                  lightMode ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                Sincronização em Nuvem (NoteOn Cloud)
              </h2>
              <p
                className={`text-xs ${
                  lightMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Acesse suas aulas no Celular e no PC em tempo real
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          {/* Pair info illustration */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-around gap-2 text-center ${
              lightMode ? 'bg-indigo-50/60 border-indigo-200' : 'bg-indigo-950/20 border-indigo-800/40'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <Laptop className="w-6 h-6 text-indigo-400" />
              <span className="text-[11px] font-semibold text-slate-300">Seu Computador</span>
            </div>
            <div className="flex items-center gap-1 text-indigo-400 font-bold text-sm animate-pulse">
              <span>↔</span>
              <Cloud className="w-4 h-4" />
              <span>↔</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Smartphone className="w-6 h-6 text-cyan-400" />
              <span className="text-[11px] font-semibold text-slate-300">Seu Celular</span>
            </div>
          </div>

          {currentUser ? (
            /* Logged in state */
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  lightMode
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold block text-xs">
                      {currentUser.email}
                    </span>
                    <span className="text-[11px] text-emerald-400/90 block">
                      Última sincronização: {formatLastSync(lastSyncedTime)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onPerformSync}
                disabled={isSyncing}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando agora...' : 'Sincronizar Agora (PC ↔ Celular)'}</span>
              </button>

              <div className="pt-2 border-t border-slate-800/50 flex justify-between items-center">
                <span className="text-[11px] text-slate-400">
                  Dica: Abra o NoteOn no celular e entre com esta mesma conta.
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition cursor-pointer font-medium flex items-center gap-1 text-[11px]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          ) : (
            /* Logged out: Login / Register Form */
            <div className="space-y-3">
              {/* Tab Selector */}
              <div
                className={`flex p-1 rounded-xl border text-xs font-semibold ${
                  lightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    tab === 'login'
                      ? 'bg-indigo-600 text-white shadow'
                      : lightMode
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    tab === 'register'
                      ? 'bg-indigo-600 text-white shadow'
                      : lightMode
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Criar Conta</span>
                </button>
              </div>

              <form onSubmit={handleSubmitAuth} className="space-y-3">
                <div>
                  <label
                    className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${
                      lightMode ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      lightMode
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-slate-800 border-slate-700 text-slate-100'
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${
                      lightMode ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    Senha (mínimo 6 dígitos)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      lightMode
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-slate-800 border-slate-700 text-slate-100'
                    }`}
                  />
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer transition disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : tab === 'register' ? (
                    <UserPlus className="w-4 h-4" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  <span>
                    {loading
                      ? 'Processando...'
                      : tab === 'register'
                      ? 'Criar Conta e Sincronizar'
                      : 'Entrar e Sincronizar'}
                  </span>
                </button>
              </form>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed mt-2">
                Cadastre-se com o mesmo e-mail no PC e no celular para sincronizar tudo automaticamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
