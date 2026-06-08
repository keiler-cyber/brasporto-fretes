# PRD — Brasporto Fretes
## Sistema de Comparação de Cotações de Frete Internacional
**Versão:** 1.0  
**Data:** Junho 2026  
**Status:** Produção

---

## 1. Visão Geral

O **Brasporto Fretes** é uma plataforma web que automatiza o processo de análise e comparação de cotações de frete internacional (Aéreo, FCL e LCL). O sistema utiliza Inteligência Artificial (Claude API) para extrair dados de PDFs de cotações recebidas por email, calcular custos totais, gerar rankings automáticos e produzir relatórios profissionais em PDF.

**URL de produção:** https://brasporto-fretes.vercel.app

---

## 2. Problema

O processo atual de comparação de fretes na Brasporto é manual:
- Abertura individual de cada email/PDF de cotação
- Transcrição manual de valores para planilhas
- Cálculos manuais de peso taxado, cubagem e custo total
- Risco elevado de erro humano
- Tempo excessivo para decisão (horas por processo)
- Sem padronização de critérios de decisão

---

## 3. Objetivo

Reduzir o tempo de análise de cotações de horas para minutos, eliminando trabalho manual e padronizando o critério de decisão com score objetivo.

---

## 4. Usuários

- **Pricing Desk / Analistas de Cotação** — usuários principais
- **Coordenadores de Logística** — aprovação e consulta de histórico
- **Acesso restrito** a emails `@brasporto.com`

---

## 5. Fluxo Principal

```
1. SOLICITAÇÃO DO CLIENTE
   └─ Upload do PDF do pedido do cliente (email de solicitação)
   └─ Extração automática: origem, destino, peso, dimensões, incoterm, modal

2. CONFERÊNCIA LOGÍSTICA
   └─ Visualização dos dados extraídos (somente leitura)
   └─ Cálculo automático de peso taxado para AÉREO
   └─ Container e quantidade para FCL

3. COTAÇÕES DOS AGENTES
   └─ Upload de múltiplos PDFs de cotações (um ou vários por arquivo)
   └─ Extração automática de todos os valores

4. VALIDAÇÃO E COMPARAÇÃO
   └─ Revisão das cotações extraídas
   └─ Sem edição manual — dados sempre da extração

5. DECISÃO
   └─ Ranking automático com score
   └─ Justificativa clara por opção
   └─ Geração de relatório PDF
```

---

## 6. Funcionalidades

### 6.1 Extração de Dados (IA)

**Pedido do Cliente:**
- Cliente, referência/processo, modal desejado, incoterm
- Origem (coleta), destino (entrega)
- Peso bruto, volume (m³), dimensões, quantidade de volumes
- Container e quantidade (FCL)
- Mercadoria, NCM, valor, ready date, ETA máximo

**Cotações dos Agentes:**
- Nome da empresa agente (nunca nome de pessoa)
- Carrier (companhia aérea ou armador)
- Modal (AEREO / FCL / LCL) — inferido por indicadores no documento
- Incoterm, moeda
- Frete base, taxa por kg, break tarifário (+45K, +100K, +200K, etc.)
- Taxas de origem (THC, X-RAY, SFS, FSC, handling, AWB fee, etc.)
- Taxas de destino
- Pickup (por aeroporto, quando múltiplas opções)
- Outras despesas
- Taxas em BRL para Brasil (LCL) — separadas, só para referência
- Transit time, ETD, free time
- Cancellation fee: **ignorado** (não entra no custo)

### 6.2 Cálculo de Peso (AÉREO)

```
Peso cubado = (comp_cm × larg_cm × alt_cm) / 6.000
Peso taxado = max(peso_bruto, peso_cubado)           ← sempre o maior
Peso efetivo = max(peso_taxado, mínimo_do_break)     ← respeita tier tarifário
Frete = peso_efetivo × tarifa/kg
```

**Break tarifário:**
- "+45K" = mínimo 45kg. Carga de 80kg → usa 80kg (não 45kg)
- Quando múltiplos breaks disponíveis → calcula em cada e usa o mais barato

### 6.3 Custo Total para Comparação

```
Total = Frete Base + Taxas Origem + Taxas Destino + Pickup + Outros
```
- Taxas em BRL **não entram** na comparação — só exibidas como referência
- Cancellation fee **não entra**

### 6.4 Scoring e Ranking

**Pesos:**
| Critério | Peso |
|---|---|
| Custo Total | 50% |
| Transit Time | 30% |
| Condições Operacionais (free time + ETD) | 20% |

- Custo normalizado dentro da mesma moeda
- Todas as cotações recebem posição (não apenas top 3)
- Justificativa em linguagem clara: "Menor custo total", "Menor transit time", etc.

### 6.5 Relatório PDF

**Estrutura (A4 Landscape):**
1. Header: Logo Brasporto + Título + ID/Data/Responsável
2. Barra de processo (5 etapas)
3. Seção superior: Resumo da Solicitação | Dados da Carga | Status Conformidade
4. Tabela de cotações com breakdown completo:
   - Empresa agente + carrier
   - Peso efetivo, taxa/kg, frete calculado (fórmula visível)
   - Taxas de origem, destino, pickup, outros
   - **Total Geral** em destaque
   - Taxas BRL como referência (LCL)
   - Transit time, rota, ETD, free time
   - Coluna "Decisão": MENOR CUSTO / MENOR PRAZO / MELHOR CUSTEIO
5. Rodapé: Critérios 50/30/20 | Legenda score | Resumo da decisão | Ranking final

### 6.6 Autenticação

- Firebase Authentication
- Restrição de domínio: apenas `@brasporto.com`
- Recuperação de senha via email (Firebase)
- Auto-logout se domínio inválido

### 6.7 Histórico

- Cotações salvas no Firestore por 15 dias
- Expiração automática
- Filtro por agente/modal
- Visualização detalhada por cotação

---

## 7. Arquitetura Técnica

| Componente | Tecnologia |
|---|---|
| Frontend | Next.js 16 (App Router) |
| Estilo | Tailwind CSS |
| Autenticação | Firebase Auth |
| Banco de Dados | Firestore |
| IA / Extração | Anthropic Claude (claude-sonnet-4-6) |
| PDF (geração) | @react-pdf/renderer |
| Deploy | Vercel (Hobby) |
| Domínio | brasporto-fretes.vercel.app |

---

## 8. Regras de Negócio Críticas

1. **Brasporto nunca é o agente** — é a importadora/solicitante
2. **Nome do agente = empresa**, nunca pessoa física
3. **Carrier obrigatório** — cia aérea ou armador sempre exibidos
4. **Sem input manual** — toda informação vem da extração da IA
5. **Comparação em moeda única** — BRL é só referência visual
6. **Cancellation fee ignorado** sempre
7. **Break tarifário**: peso_efetivo = max(peso_taxado, mínimo_break)
8. **Múltiplos breaks**: calcular em cada e usar o mais barato
9. **Múltiplas opções por PDF**: uma cotação pode gerar N linhas no ranking

---

## 9. Melhorias Futuras (Backlog)

- [ ] Frequência de voos/saídas por rota
- [ ] Validade da cotação como critério de elegibilidade
- [ ] Comparação de demurrage/detention para FCL
- [ ] Campos de validação: Peso/Dim OK, Ready Date OK, Prazo OK
- [ ] Responsável preenchido automaticamente (usuário logado)
- [ ] Numeração automática de cotações (ID sequencial)
- [ ] Exportação para Excel além do PDF
- [ ] Notificações por email ao gerar relatório
- [ ] Histórico com busca por cliente/referência
- [ ] Dashboard com métricas (economia média, agentes mais usados)

---

## 10. Acesso e Credenciais

| Recurso | Informação |
|---|---|
| Sistema | https://brasporto-fretes.vercel.app |
| Firebase | console.firebase.google.com → brasporto-fretes |
| Vercel | vercel.com → krzamaral-9394's projects |
| Modelo IA | claude-sonnet-4-6 |
