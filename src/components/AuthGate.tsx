import React, { useState } from 'react';
import { useUser, AppUser } from '@/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
import { Activity, User, Lock, ArrowRight, ShieldCheck, Sparkles, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { currentUser, knownUsers, isLoadingAuth, loginOrRegister } = useUser();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (currentUser) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await loginOrRegister(name, password);
    if (!res.ok) {
      setErrorMsg(res.error || 'Não foi possível entrar.');
      return;
    }
    if (res.isNew) {
      toast(`Conta criada! Bem-vindo(a) ao seu espaço individual, ${name.trim()}!`, 'success');
    } else {
      toast(`Bem-vindo(a) de volta, ${name.trim()}!`, 'success');
    }
  };

  const handleQuickSelectUser = async (u: AppUser) => {
    setErrorMsg('');
    if (u.hasPassword) {
      setName(u.name);
      setErrorMsg(`Digite a senha de "${u.name}" abaixo para entrar.`);
      return;
    }
    const res = await loginOrRegister(u.name, '');
    if (res.ok) {
      toast(`Bem-vindo(a) de volta, ${u.name}!`, 'success');
    } else if (res.error) {
      setName(u.name);
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-400/30 text-teal-300 shadow-lg mb-1">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">EvoluTigas</h1>
          <p className="text-sm text-teal-100/80 max-w-xs mx-auto">
            Plataforma de evolução hospitalar, ambulatório e formulários médicos para a turma.
          </p>
        </div>

        <Card className="border-slate-800 bg-white/95 backdrop-blur shadow-2xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              Entrar ou Criar Conta Rápida
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Digite apenas seu <strong>nome</strong> (e uma senha se quiser). Se for seu primeiro acesso, sua conta individual é criada na hora!
            </p>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-600" />
                  Seu Nome ou Apelido *
                </Label>
                <Input
                  placeholder="Ex: Lucas, Mariana, Thiago..."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  className="h-10 text-sm"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    Senha (Opcional)
                  </Label>
                  <span className="text-[11px] text-slate-400">Pode deixar em branco</span>
                </div>
                <Input
                  type="password"
                  placeholder="Deixe vazio ou crie/digite sua senha..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  className="h-10 text-sm"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {errorMsg}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoadingAuth || !name.trim()}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md"
              >
                {isLoadingAuth ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando no seu espaço...
                  </>
                ) : (
                  <>
                    Acessar Meu Espaço Individual <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {knownUsers.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Contas da turma já cadastradas:
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {knownUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickSelectUser(u)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 transition-colors"
                    >
                      <User className="w-3 h-3 text-teal-600" />
                      <span>{u.name}</span>
                      {u.hasPassword && <Lock className="w-3 h-3 text-amber-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  <strong>100% Individual por Colega:</strong> Seus pacientes da enfermaria, notas de ambulatório e moldes de formulários ficam salvos separadamente na sua conta.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>IA Gratuita + Sua Própria IA:</strong> Use a IA integrada grátis ou clique em <em>"Usar Meu ChatGPT / Gemini"</em> em qualquer tela sem custo.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
