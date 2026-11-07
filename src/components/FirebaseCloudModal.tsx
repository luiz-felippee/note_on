import React, { useState } from 'react';
import {
  Cloud,
  X,
  CheckCircle2,
  RefreshCw,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { FirebaseConfigData } from '../types';
import {
  getSavedFirebaseConfig,
  saveFirebaseConfig,
  loginWithGoogle,
  loginWithEmail,
  logoutFirebase,
  syncAllFromAndToCloud,
} from '../services/storageService';

interface FirebaseCloudModalProps {
  user: User | null;
  onClose: () => void;
  onSynced: () => void;
}

export const FirebaseCloudModal: React.FC<FirebaseCloudModalProps> = ({
  user,
  onClose,
  onSynced,
}) => {
  const existingConfig = getSavedFirebaseConfig();
  const [showConfigForm, setShowConfigForm] = useState(!existingConfig?.apiKey);
  const [jsonPaste, setJsonPaste] = useState('');
  const [config, setConfig] = useState<FirebaseConfigData>(
    existingConfig || {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    }
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleParsePaste = (raw: string) => {
    setJsonPaste(raw);
    try {
      const extract = (key: string) => {
        const regex = new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`);
        const m = raw.match(regex);
        return m ? m[1] : '';
      };
      const apiKey = extract('apiKey');
      const projectId = extract('projectId');
      if (apiKey && projectId) {
        setConfig({
          apiKey,
          authDomain: extract('authDomain') || `${projectId}.firebaseapp.com`,
          projectId,
          storageBucket: extract('storageBucket') || `${projectId}.appspot.com`,
          messagingSenderId: extract('messagingSenderId'),
          appId: extract('appId'),
        });
        setErrorMsg(null);
        setStatusMsg('Configuração reconhecida automaticamente!');
      }
    } catch {
      // ignore partial paste
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.apiKey || !config.projectId) {
      setErrorMsg('Preencha pelo menos apiKey e projectId do Firebase.');
      return;
    }
    saveFirebaseConfig(config);
    setShowConfigForm(false);
    setErrorMsg(null);
    setStatusMsg('Projeto Firebase conectado com sucesso! Agora você pode fazer login.');
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      setStatusMsg('Login com Google realizado e dados sincronizados!');
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao fazer login com Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await loginWithEmail(email, password, isRegister);
      setStatusMsg(
        isRegister
          ? 'Conta criada e sincronizada com sucesso!'
          : 'Login efetuado e dados sincronizados!'
      );
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha na autenticação por e-mail.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await syncAllFromAndToCloud();
      setStatusMsg(
        `Sincronização concluída! (${res.pushed} itens enviados, ${res.pulled} recebidos)`
      );
      onSynced();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao sincronizar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 sm:hidden" />
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                Nuvem Firebase
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Sincronização offline-first e backup em nuvem
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Local Storage Status Banner */}
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-200">
                <span className="font-semibold block text-emerald-300">
                  Banco Local IndexedDB Ativo (Proteção Total Offline)
                </span>
                Suas fotos, áudios e textos nunca são perdidos mesmo sem internet.
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>

          {statusMsg && (
            <div className="rounded-xl bg-indigo-500/15 border border-indigo-500/30 p-3 text-xs text-indigo-200 font-medium">
              {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Toggle Config View */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {existingConfig?.projectId
                ? `Projeto Conectado: ${existingConfig.projectId}`
                : 'Configurar Projeto Firebase'}
            </span>
            <button
              type="button"
              onClick={() => setShowConfigForm((v) => !v)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{showConfigForm ? 'Ocultar Chaves' : 'Editar Chaves Firebase'}</span>
            </button>
          </div>

          {showConfigForm ? (
            <form
              onSubmit={handleSaveConfig}
              className="space-y-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Colar snippet `firebaseConfig` (preenche os campos automaticamente)
                </label>
                <textarea
                  rows={3}
                  value={jsonPaste}
                  onChange={(e) => handleParsePaste(e.target.value)}
                  placeholder='Cole aqui o bloco const firebaseConfig = { apiKey: "...", projectId: "..." } do console do Firebase'
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">API Key *</label>
                  <input
                    type="text"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value.trim() })}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white"
                    placeholder="AIzaSy..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">
                    Project ID *
                  </label>
                  <input
                    type="text"
                    value={config.projectId}
                    onChange={(e) =>
                      setConfig({ ...config, projectId: e.target.value.trim() })
                    }
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white"
                    placeholder="meu-noteon-app"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">
                    Auth Domain
                  </label>
                  <input
                    type="text"
                    value={config.authDomain}
                    onChange={(e) =>
                      setConfig({ ...config, authDomain: e.target.value.trim() })
                    }
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white"
                    placeholder="meu-app.firebaseapp.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">
                    Storage Bucket
                  </label>
                  <input
                    type="text"
                    value={config.storageBucket}
                    onChange={(e) =>
                      setConfig({ ...config, storageBucket: e.target.value.trim() })
                    }
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white"
                    placeholder="meu-app.appspot.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                Salvar Configuração Firebase
              </button>
            </form>
          ) : user ? (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                    {(user.email || user.displayName || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {user.displayName || 'Estudante Conectado'}
                    </div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Online
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleManualSync}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Sincronizar Agora</span>
                </button>
                <button
                  type="button"
                  onClick={logoutFirebase}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs flex items-center justify-center gap-2 shadow transition cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-indigo-600" />
                <span>Entrar com Conta Google</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800" />
                <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase">
                  ou E-mail e Senha
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-2.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail de estudante"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha (mínimo 6 caracteres)"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRegister((v) => !v)}
                    className="text-xs text-indigo-400 hover:underline cursor-pointer"
                  >
                    {isRegister ? 'Já tenho conta (Fazer Login)' : 'Criar nova conta'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    {isRegister ? 'Cadastrar e Sincronizar' : 'Entrar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
