# EvoluTigas — Plataforma Médica de Evolução Clínica, Ambulatório e Calculadoras

Plataforma médica completa com evolução de enfermaria, ambulatório com modelos por especialidade, transcrição inteligente de exames (fotos/PDF), calculadoras médicas e documentos hospitalares (incluindo AIH SUS em 2 vias).

---

## 🚀 Como publicar gratuitamente pelo GitHub (100% Grátis / Sem Cartão)

Este repositório já está **100% configurado** com automação (`.github/workflows/deploy.yml`, `vercel.json` e `netlify.toml`) para publicar o site gratuitamente.

### Opção A: Publicar direto no GitHub Pages (`seu-usuario.github.io/evolutigas`)
1. No seu repositório do GitHub, clique na aba **Settings** (Configurações) no topo.
2. No menu lateral esquerdo, clique em **Pages**.
3. Em **Build and deployment** > **Source**, mude de *Deploy from a branch* para **GitHub Actions**.
4. *(Opcional — Para a IA Integrada funcionar no GitHub Pages)*:
   - No menu lateral esquerdo de **Settings**, clique em **Secrets and variables** > **Actions**.
   - Clique em **New repository secret**, coloque o nome `GEMINI_API_KEY` e cole sua chave gratuita gerada em [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
5. Vá na aba **Actions** no topo do GitHub e clique em **Publicar EvoluTigas no GitHub Pages** > **Run workflow** (caso ainda não tenha rodado sozinho).
6. Pronto! Em 1 minuto seu site estará público em `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.

---

### Opção B: Publicar na Vercel (`evolutigas.vercel.app`)
1. Acesse [vercel.com](https://vercel.com) e entre com sua conta do GitHub (plano Hobby 100% gratuito, sem cartão).
2. Clique em **Add New** > **Project** e selecione este repositório do GitHub.
3. Em **Environment Variables**, adicione `GEMINI_API_KEY` com sua chave gratuita do Google AI Studio.
4. Clique em **Deploy**.
