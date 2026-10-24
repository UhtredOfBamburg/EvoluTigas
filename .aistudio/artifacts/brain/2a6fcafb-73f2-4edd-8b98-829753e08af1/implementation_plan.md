# Refinamento Visual, Produtividade e Otimização do Evolutigas

Este plano entrega um pacote de refinamento de usabilidade, conforto visual e segurança de dados para o uso diário no hospital: **Modo Plantão Noturno (Dark Mode)**, **Busca Global Rápida (`Ctrl+K`)**, **Auto-salvamento Contínuo de Rascunhos**, **Layout Compacto nas Fichas Clínicas** e **Unificação da Central de Formulários**.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo refletem exatamente as prioridades selecionadas nas perguntas anteriores:

- **Decisão Confirmada 1 — Modo Plantão Noturno (Conforto Visual)**: Alternador rápido ("Modo Claro / Plantão Noturno") na barra lateral e no cabeçalho mobile, aplicando paleta escura de baixo brilho (`slate-900` / `slate-950`) ideal para enfermarias e salas de plantão à noite.
- **Decisão Confirmada 2 — Busca Global Instantânea (`Ctrl+K` / `⌘K`)**: Paleta de comando acessível de qualquer tela (por atalho de teclado ou botão na barra lateral) para abrir imediatamente qualquer leito da enfermaria, paciente de ambulatório, calculadora médica específica (ex.: *Noradrenalina*, *CKD-EPI*, *MELD-Na*, *qSOFA*) ou formulário PDF.
- **Decisão Confirmada 3 — Auto-Salvamento Contínuo de Rascunhos**: Todos os campos preenchidos e textos gerados na evolução diária, admissão, sumário de alta e consulta ambulatorial são salvos automaticamente a cada alteração, evitando perda de dados caso o navegador recarregue ou a tela do celular apague.
- **Decisão Confirmada 4 — Layout Clínico Mais Compacto**: Redução de espaçamentos verticais excessivos, agrupamento enxuto de sinais vitais e exame físico e visualização lado a lado otimizada na Enfermaria e no Ambulatório.
- **Decisão Confirmada 5 — Unificação da Central de Formulários e Meus Formulários**: Remoção da tela separada no menu lateral e integração completa do gerenciamento de moldes PDF (selecionar, renomear, ajustar caixas no PDF, excluir e importar novo PDF) em uma única tela na **Central de Formulários**.

---

## 1. Overview & Core Concept

- **O Que Faz**: Transforma o Evolutigas em uma estação clínica mais rápida, enxuta e à prova de perda de dados, eliminando cliques duplicados entre telas e adaptando a leitura para plantões diurnos e noturnos.
- **Público-Alvo**: Internos, residentes e médicos em rotina de enfermaria, pronto-socorro e ambulatório.
- **Valor Principal**: Zero perda de evolução por fechamento acidental de aba, navegação em menos de 1 segundo para qualquer leito ou calculadora via `Ctrl+K`, e menos rolagem nas fichas clínicas.

---

## 2. User Experience & Visual Design

- **Fluxos Principais**:
  1. **Busca Rápida (`Ctrl+K`)**: O usuário pressiona `Ctrl+K` (ou clica em "Buscar leito ou calculadora..." na barra lateral), digita ex.: `"12A"`, `"Nora"` ou `"CKD"`, e pressiona `Enter` para ir direto ao leito ou à aba exata da calculadora.
  2. **Modo Plantão Noturno**: Com 1 clique no ícone de lua/sol na barra lateral ou topo mobile, toda a interface alterna entre o modo clínico claro e o modo noturno de alto contraste suave.
  3. **Auto-Salvamento Transparente**: Enquanto o médico digita a evolução da enfermaria ou a HDA no ambulatório, um indicador discreto exibe `"Rascunho salvo automaticamente"` no cabeçalho da ficha, permitindo retomar exatamente de onde parou.
  4. **Central de Formulários Unificada**: Na barra superior da Central de Formulários, cada molde PDF pode ser selecionado para preenchimento imediato ou gerenciado (renomear, ajustar caixas, excluir ou limpar todos) sem precisar trocar de página.
- **Identidade Visual & Tema**:
  - *Modo Claro*: Fundo `slate-50`, superfícies `white`, bordas `slate-200`, destaque `teal-600`.
  - *Modo Plantão Noturno*: Fundo `slate-950`, cartões `slate-900`, bordas `slate-800`, texto principal `slate-100` e destaque `teal-500`.
  - *Tipografia & Densidade*: Números e doses sempre alinhados com `font-mono tabular-nums`; controles de formulário com altura compacta e espaçamento reduzido para caber mais informações clínicas na mesma tela.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1 — Unificação da Central de Formulários**
  - *Abordagem Escolhida*: Consolidar o preenchimento ao vivo e a gestão dos moldes PDF ("Gerenciar Meus Moldes") dentro da própria Central de Formulários, removendo o item redundante do menu lateral.
  - *Por quê*: Elimina a confusão entre duas telas de formulários e reduz o menu lateral para os módulos essenciais.
- **Decisão 2 — Auto-Salvamento por Paciente na Enfermaria**
  - *Abordagem Escolhida*: Salvar o rascunho de `formData`, `admissaoData`, `altaData` e textos gerados indexados pelo `id` do paciente.
  - *Por quê*: Permite alternar entre o Leito 12A e o Leito 14B durante a visita médica sem perder nenhuma alteração em andamento em cada leito.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Layout Principal & Navegação                        │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌──────────────┐  │
│  │ Busca Global (Ctrl+K)   │  │ Toggle Plantão Noturno│  │ Menu Enxuto  │  │
│  │ (Leitos, Calc, Moldes)  │  │ (Persistência Tema)   │  │ (7 Módulos)  │  │
│  └───────────┬─────────────┘  └───────────┬───────────┘  └──────┬───────┘  │
└──────────────┼────────────────────────────┼─────────────────────┼──────────┘
               │                            │                     │
      ┌────────▼────────┐          ┌────────▼────────┐   ┌────────▼────────┐
      │   Enfermaria    │          │   Ambulatório   │   │   Central de    │
      │ Layout Compacto │          │ Layout Compacto │   │   Formulários   │
      │ + Auto-Save     │          │ + Auto-Save     │   │   Unificada     │
      │   por Leito     │          │   Contínuo      │   │ (Preencher +    │
      └─────────────────┘          └─────────────────┘   │  Gerir Moldes)  │
                                                         └─────────────────┘
```

- **Mapeamento de Estado e Interações**:
  - **Paleta de Comando (`Ctrl+K`)**: Indexa dinamicamente todos os pacientes ativos da Enfermaria, pacientes do Ambulatório, as 12 Calculadoras (com palavras-chave de drogas e fórmulas) e os moldes PDF salvos. Ao selecionar uma calculadora, navega para `/calculadoras` passando `{ state: { initialTab } }` para abrir a calculadora exata.
  - **Auto-Save de Rascunhos**: Sincroniza alterações de formulário com chaves dedicadas no armazenamento local (`rascunho_enfermaria_${id}` e `rascunho_ambulatorio_ativo`), exibindo horário do último salvamento e opção "Restaurar Padrão" quando desejado.
  - **Unificação de Rotas**: A rota `/formularios/meus` redireciona automaticamente para `/formularios` com o painel de gestão de moldes aberto, garantindo que nenhum link antigo quebre.
