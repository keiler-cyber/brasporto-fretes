# Brasporto - Sistema de Comparação de Fretes

Sistema web para automação de extração de dados de cotações internacionais e matriz de decisão para comparação de fretes.

## 🚀 Setup Inicial

### 1. Configurar Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um novo projeto chamado `brasporto-fretes`
3. Na seção **Authentication**:
   - Vá em "Sign-in method"
   - Ative **Email/Password**
4. Na seção **Firestore Database**:
   - Crie um novo banco em modo "Start in test mode"
   - Escolha localização: `us-east1` (ou a mais próxima)
5. Em **Project Settings** (engrenagem no canto superior):
   - Vá em "Web app" e registre seu app
   - Copie as credenciais exibidas

### 2. Preencher arquivo `.env.local`

Abra o arquivo `.env.local` na raiz do projeto e preencha com suas credenciais Firebase:

```
NEXT_PUBLIC_FIREBASE_API_KEY=<sua_api_key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<seu_project>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<seu_project_id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<seu_project>.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<seu_sender_id>
NEXT_PUBLIC_FIREBASE_APP_ID=<seu_app_id>
ANTHROPIC_API_KEY=<sua_chave_claude>
```

**Onde obter as credenciais:**
- Firebase: Firebase Console → Project Settings → Web app
- Anthropic: [console.anthropic.com](https://console.anthropic.com)

### 3. Instalar dependências

```bash
npm install
```

### 4. Rodar desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## 📋 Estrutura do Projeto

```
src/
├── app/
│   ├── layout.tsx           # Layout raiz com AuthProvider
│   ├── page.tsx             # Página inicial (redirecionamento)
│   ├── login/
│   │   └── page.tsx         # Página de login/registro
│   ├── dashboard/
│   │   └── page.tsx         # Dashboard principal
│   ├── upload/
│   │   └── page.tsx         # Fluxo de upload e análise
│   └── api/
│       └── extract-pdf/
│           └── route.ts     # API para extração com Claude
├── components/              # Componentes React reutilizáveis
│   ├── PDFUpload.tsx        # Upload com drag-and-drop
│   ├── ReviewExtraction.tsx # Tela de revisão dos dados
│   ├── RankingDisplay.tsx   # Exibição do Top 3
│   └── ReportPDF.tsx        # Geração do PDF final
├── lib/
│   ├── firebase.ts          # Configuração Firebase
│   ├── auth-context.tsx     # Context de autenticação
│   ├── types.ts             # Tipos TypeScript
│   └── scoring.ts           # Lógica de scoring/ranking
└── globals.css              # Estilos globais
```

## 🔑 Funcionalidades Implementadas

- ✅ Autenticação Firebase (email/senha)
- ✅ Validação de domínio @brasporto.com
- ✅ Dashboard com histórico de cotações (15 dias)
- ✅ Upload de PDF com drag-and-drop
- ✅ Extração automática com Claude Vision
- ✅ Tela de revisão dos dados extraídos
- ✅ Cálculo automático de scoring e ranking
- ✅ Exibição do Top 3 com justificativas
- ✅ Geração de relatório PDF profissional
- ✅ Sistema de tipos TypeScript

## 🔄 Fluxo de Funcionamento

1. **Login**: Usuário faz login com email @brasporto.com
2. **Dashboard**: Visualiza histórico de cotações
3. **Upload**: Clica "Enviar PDF" para nova cotação
4. **Extração**: Claude extrai dados automaticamente (Agent, Modal, Custo, TT, ETD, FT, etc)
5. **Revisão**: Usuário revisa dados em tela de conferência obrigatória
6. **Confirmação**: Clica "Confirmar Extração"
7. **Scoring**: Sistema calcula score automaticamente
8. **Ranking**: Exibe Top 3 com justificativas textuais
9. **Relatório**: Gera e baixa PDF com barra de progresso

## 📊 Matriz de Scoring

```
N = (C × 0.40) + (TT × 0.30) + (ETD × 0.20) + (FT × 0.10)

C: Custo (menor = melhor) — 40%
TT: Transit Time (menor = melhor) — 30%
ETD: Data saída (proximidade = melhor) — 20%
FT: Free Time (maior = melhor) — 10%
```

## 🗄️ Banco de Dados (Firestore)

Estrutura de coleção `quotations`:

```
quotations/
├── id                          # ID único do documento
├── userId                      # UID do usuário Firebase
├── createdAt                   # Data de criação
├── expiresAt                   # Expira em 15 dias
├── originalFileName            # Nome do arquivo PDF
├── pdfUrl                      # URL do arquivo (opcional)
├── extractedData               # Dados extraídos pelo Claude
│   ├── agentName               # Nome da transportadora
│   ├── modal                   # AEREO | FCL | LCL
│   ├── baseCost                # Valor do frete
│   ├── currency                # USD | EUR | BRL
│   ├── transitTime             # Dias (opcional)
│   ├── etd                     # Data de saída (opcional)
│   ├── freeTime                # Dias de free time (opcional)
│   ├── weight                  # Peso em kg (opcional)
│   ├── measurement             # Medida volumétrica (opcional)
│   └── rawData                 # Resposta bruta do Claude
├── score                       # Pontuação final (0-1)
├── ranking                     # Posição (1, 2, 3 ou null)
└── status                      # CONFIRMED | RANKED
```

## 🧪 Testando o Sistema

### Criar conta de teste:
1. Vá para [http://localhost:3000](http://localhost:3000)
2. Clique em "Criar conta"
3. Use email: `teste@brasporto.com` e senha qualquer

### Enviar PDF de teste:
1. Clique em "Enviar PDF"
2. Use um PDF de cotação ou crie um com texto simples:
   ```
   COTAÇÃO DE FRETE
   
   Agente: DHL Express
   Modal: AEREO
   Frete Base: 2500 USD
   Peso Taxável: 100 kg
   Transit Time: 3 dias
   ETD: 2025-06-15
   ```

## 🛠️ Build para Produção

```bash
npm run build
npm run start
```

## 📦 Deploy (Recomendado: Vercel)

```bash
# Instale Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Vercel automaticamente:
- Detecta variáveis de ambiente em `.env.local`
- Faz build otimizado
- Hospeda na CDN global

## 🚨 Troubleshooting

### Erro: "Firebase config not found"
- Verifique se `.env.local` está preenchido com as credenciais corretas
- Reinicie o servidor: `npm run dev`

### Erro: "Anthropic API key not found"
- Crie uma chave em [console.anthropic.com](https://console.anthropic.com)
- Adicione em `.env.local` como `ANTHROPIC_API_KEY`

### Erro: "Only @brasporto.com emails allowed"
- Use um email com domínio `@brasporto.com` para criar conta

### PDF não está sendo processado
- Verifique se o PDF é válido e não está corrompido
- Aguarde 15 segundos (limite de timeout)
- Verifique o console do navegador (F12) para erros

## 📞 Suporte

Para dúvidas sobre:
- **Firebase**: [Firebase Docs](https://firebase.google.com/docs)
- **Claude API**: [Claude Docs](https://docs.anthropic.com)
- **Next.js**: [Next.js Docs](https://nextjs.org/docs)
- **Tailwind CSS**: [Tailwind Docs](https://tailwindcss.com/docs)

## 📝 Notas Importantes

1. **Dados de teste**: Histórico é deletado automaticamente após 15 dias
2. **Moedas**: Sistema não converte moedas, mantém valores originais do PDF
3. **Edição**: Não há edição de dados após extração (reenviar PDF se houver erro)
4. **Segurança**: Não há criptografia em repouso nesta versão (MVP)
5. **Logs**: Não há auditoria detalhada (MVP)

## 🎯 Próximas Melhorias

- [ ] Edição manual de campos extraídos
- [ ] Comparação entre múltiplas rodadas de cotação
- [ ] Integração com email para notificações
- [ ] Exportação de dados para Excel
- [ ] Dashboard com gráficos e análises
- [ ] API pública para integrações
- [ ] Aplicativo mobile
- [ ] Autenticação com SSO corporativo

