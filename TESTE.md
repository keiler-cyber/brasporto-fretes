# Testando o Sistema - Exemplos de Cotações

Este arquivo contém exemplos de dados que você pode usar para testar o sistema.

## 📄 Como criar um PDF de teste

### Opção 1: Usar Word/Google Docs
1. Copie o texto de um dos exemplos abaixo
2. Cole no Word ou Google Docs
3. Salve como PDF

### Opção 2: Usar um serviço online
1. Acesse [justpaste.it](https://justpaste.it) ou similar
2. Cole o texto abaixo
3. Exporte como PDF (usar Print → Save as PDF)

---

## 📋 Exemplo 1: Cotação Aérea

```
╔════════════════════════════════════════════════════════════╗
║                    DHL EXPRESS                            ║
║              COTAÇÃO DE FRETE AÉREO                        ║
╚════════════════════════════════════════════════════════════╝

DATA: 26/05/2025
VÁLIDA POR: 30 dias

CLIENTE: Brasporto Logística
ORIGEM: São Paulo (GRU)
DESTINO: Miami (MIA)

═══════════════════════════════════════════════════════════

DETALHES DA COTAÇÃO:

• Agente: DHL Express
• Modal: AÉREO
• Frete Base: 2.500 USD
• Peso Taxável: 100 kg
• Transit Time: 3 dias
• ETD: 15/06/2025
• ETA: 18/06/2025

═══════════════════════════════════════════════════════════

OBSERVAÇÕES:
- Preço inclui coleta
- Válido para até 100 kg
- Documentação: Conhecimento de Embarque Aéreo

Assinado digitalmente
DHL Express - São Paulo
```

---

## 📋 Exemplo 2: Cotação Marítima FCL

```
╔════════════════════════════════════════════════════════════╗
║                  MAERSK LINE                              ║
║         COTAÇÃO DE CONTAINER CHEIO (FCL)                  ║
╚════════════════════════════════════════════════════════════╝

DATA: 25/05/2025
VÁLIDA POR: 7 dias

CLIENTE: Brasporto Logística
ORIGEM: Santos (SSZ)
DESTINO: Rotterdam (RTMXXX)

═══════════════════════════════════════════════════════════

DETALHES DA COTAÇÃO:

• Agente: Maersk Line
• Modal: FCL (40ft)
• Frete Base: 3.500 USD
• Free Time: 14 dias
• Transit Time: 15 dias
• ETD: 10/06/2025
• ETA: 25/06/2025

═══════════════════════════════════════════════════════════

CHARGES ADICIONAIS:
- CAF (Currency Adjustment): USD 150
- THC (Terminal Handling): USD 250

Assinado digitalmente
Maersk Line - Santos
```

---

## 📋 Exemplo 3: Cotação Marítima LCL

```
╔════════════════════════════════════════════════════════════╗
║              SASCO SHIPPING                               ║
║      COTAÇÃO DE CONTAINER COMPARTILHADO (LCL)             ║
╚════════════════════════════════════════════════════════════╝

DATA: 26/05/2025
VÁLIDA POR: 15 dias

CLIENTE: Brasporto Logística
ORIGEM: São Paulo (SSZ)
DESTINO: Shanghai (CNSHA)

═══════════════════════════════════════════════════════════

DETALHES DA COTAÇÃO:

• Agente: SASCO Shipping
• Modal: LCL
• Frete Base: 850 USD
• Medida: 2.5 m³ (Weight/Measurement)
• Peso: 2.000 kg
• Transit Time: 21 dias
• ETD: 08/06/2025
• ETA: 29/06/2025

═══════════════════════════════════════════════════════════

OBSERVAÇÕES:
- Mínimo 1 m³
- Consolidação incluída
- Seguro não incluído

Assinado digitalmente
SASCO Shipping - São Paulo
```

---

## 🧪 Testando o Sistema

### Passo 1: Criar conta
- Email: `teste@brasporto.com`
- Senha: qualquer senha com 6+ caracteres

### Passo 2: Enviar PDFs
1. Clique em "Enviar PDF"
2. Use um dos exemplos acima (converta para PDF)
3. O sistema vai extrair os dados automaticamente

### Passo 3: Revisar e confirmar
- Verifique se todos os dados estão corretos
- Clique em "Confirmar Extração"

### Passo 4: Visualizar ranking
- O sistema calcula o score de cada cotação
- Exibe o Top 3
- Gera relatório PDF

---

## ✅ Checklist de Teste

- [ ] Criar conta funciona
- [ ] Login com @brasporto.com é obrigatório
- [ ] Upload de PDF funciona
- [ ] Extração de dados automática
- [ ] Tela de revisão mostra dados corretos
- [ ] Scoring e ranking são calculados
- [ ] PDF do relatório é gerado
- [ ] Histórico persiste após reload
- [ ] Logout funciona

---

## 🐛 Se algo der errado

1. Verifique o console (F12) para erros
2. Verifique se `.env.local` está preenchido
3. Verifique se Firebase está ativo
4. Reinicie o servidor: `npm run dev`
5. Limpe o cache do navegador: Ctrl+Shift+Delete

---

## 💡 Dicas

- Use dados realistas para testes mais precisos
- Teste com diferentes modais (Aéreo, FCL, LCL)
- Envie múltiplos PDFs para testar o ranking
- Tente valores extremos (muito alto, muito baixo) para testar scoring
