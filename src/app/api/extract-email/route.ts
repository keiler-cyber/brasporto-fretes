import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { parseEML, parseMSG, extractContentFromEmail } from '@/lib/email-parser';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Mesmo prompt de extração PDF, mas adaptado para email
const EXTRACTION_PROMPT = `INSTRUÇÕES: Retorne SOMENTE JSON válido. Zero texto antes ou depois. Zero comentários. Zero expressões matemáticas — apenas números já calculados.

Você extrai dados de cotações de frete para a BRASPORTO (importador). O agente é SEMPRE quem envia a cotação, NUNCA a Brasporto.

IMPORTANTE: Você pode receber:
1. Um PDF anexado ao email (processar normalmente)
2. O conteúdo do email em texto/HTML (extrair dados de tabelas ou parágrafos)

═══ CÁLCULO DO PESO EFETIVO (AÉREO) ═══

PASSO 1 — Calcular peso taxado da carga:
  peso_cubado = (comp_cm × larg_cm × alt_cm) / 6000
  peso_taxado = max(peso_bruto_kg, peso_cubado)

PASSO 2 — Peso efetivo com break tarifário:
  O "+45K", "+100K", etc. indica o tier da tarifa. O PESO A USAR no cálculo é sempre
  o peso_taxado da carga, EXCETO se for menor que o mínimo do break.

  REGRA: peso_efetivo = max(peso_taxado, mínimo_do_break)
  FRETE = peso_efetivo × tarifa/kg

  Exemplos corretos:
  - Carga 80kg, tarifa +45K a $8/kg  → peso_efetivo = max(80, 45) = 80  → frete = 80 × 8 = $640
  - Carga 30kg, tarifa +45K a $8/kg  → peso_efetivo = max(30, 45) = 45  → frete = 45 × 8 = $360
  - Carga 150kg, tarifa +100K a $7/kg → peso_efetivo = max(150,100) = 150 → frete = 150 × 7 = $1.050
  - Carga 80kg, tarifa +100K a $7/kg  → peso_efetivo = max(80, 100) = 100 → frete = 100 × 7 = $700

  QUANDO HÁ MÚLTIPLOS BREAKS PARA MESMA ROTA (ex: +100K a $8 E +200K a $7):
  Calcular frete em cada break e usar o MENOR:
    opção A: max(peso_taxado, 100) × 8 = X
    opção B: max(peso_taxado, 200) × 7 = Y
    → usar a opção com menor custo total

PASSO 3 — Frete base:
  baseCost = peso_efetivo × ratePerKg  [número final já calculado]
  effectiveWeight = peso_efetivo (o peso que foi multiplicado pelo tarifa)

PASSO 4 — Taxas de origem com fórmula "X/K + Y, MIN Z":
  calculado = peso_taxado × X + Y
  originCharges = max(calculado, Z)

PASSO 5 — Pickup: usar valor do aeroporto POL de cada opção

═══ MÚLTIPLAS OPÇÕES ═══
Se email/PDF tem tabela com várias rotas/companhias → retornar ARRAY.
Uma opção → retornar objeto simples.

FORMATO (cada objeto):
{
  "agentName": "Nome da EMPRESA agente apenas (ex: 'UNI Logistics', 'CHL Freight', 'CNS') — REMOVER TOTALMENTE caracteres antes do nome como '.:', '->', '**', '●', '○', '■' ou números",
  "carrier": "Companhia aérea ou armador marítimo (ex: 'Emirates (EK)', 'Ethiopian (ET)', 'MSC', 'Maersk')",
  "frequency": "Frequência de saídas (apenas AÉREO): 'DAILY', '3x per week', 'MON WED FRI SAT', 'Weekly' — null se FCL/LCL ou não informado",
  "localChargesBRL": número (soma de TODAS as taxas cobradas no Brasil em BRL: THC destino, handling, entrega, desembaraço, REDEX, etc.) ou null,
  "localChargesBRLDesc": "descrição resumida das taxas em BRL (ex: 'THC + Handling + Entrega')" ou null,
  "modal": "AEREO" ou "FCL" ou "LCL",
  "incoterm": "EXW" ou outro ou null,
  "baseCost": número (frete total calculado),
  "ratePerKg": número (taxa por kg) ou null,
  "rateMinWeight": número (break tarifário usado, ex: 100 para +100K) ou null,
  "effectiveWeight": número (peso usado no cálculo do frete) ou null,
  "currency": "USD" ou "EUR" ou "BRL",
  "pickupCost": número ou null,
  "originCharges": número ou null,
  "destinationCharges": número ou null,
  "otherCharges": número ou null,
  "transitTime": número (dias, mínimo do range) ou null,
  "etd": "YYYY-MM-DD" ou null,
  "freeTime": número ou null,
  "weight": número (peso bruto da carga) ou null,
  "measurement": número (volume em m³) ou null
}

MODAL: AEREO=aeroporto/kg/AWB/companhia | FCL=container/B/L/porto | LCL=CBM/grupagem
AGENTE — usar SOMENTE o nome da EMPRESA, NUNCA o nome da pessoa:
- Remover completamente símbolos e caracteres antes do nome: "● UNI Logistics" → "UNI Logistics"
- Remover números no início: "1. CHL Freight" → "CHL Freight"
- Remover operadores: "-> CNS Logistics" → "CNS Logistics"
- Assinatura: "Dawn Zeng / UNI Logistics Inc." → "UNI Logistics"
- Email: "jacky@chlfreight.com" → "CHL Freight"
- Se só houver nome de pessoa sem empresa → usar domínio do email como empresa
- Ignorar emails @brasporto.com (são da Brasporto, não do agente)

IMPORTANTE PARA LCL: Taxas cobradas no Brasil em BRL (THC destino, handling, entrega, REDEX, etc.)
devem ir em "localChargesBRL" e NÃO em destinationCharges (que é na moeda de origem).
A comparação é feita SOMENTE pela moeda de origem — BRL é só referência visual.

TAXAS A IGNORAR (NÃO incluir em nenhum campo de custo):
- Cancellation fee / taxa de cancelamento
- Late payment fee
- Qualquer taxa que só se aplica em caso de cancelamento ou inadimplência`;

function parseJSON(text: string): any {
  let t = text.trim();
  if (t.startsWith('```json')) t = t.slice(7);
  else if (t.startsWith('```')) t = t.slice(3);
  if (t.endsWith('```')) t = t.slice(0, -3);
  t = t.trim();

  try { return JSON.parse(t); } catch {}

  // Try array
  const match = t.match(/\[\s*{[\s\S]*}\s*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  // Try single object
  const objMatch = t.match(/{[\s\S]*}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { fileBase64, fileName, fileType, cargo } = await request.json();

    if (!fileBase64 || !fileType) {
      return NextResponse.json({ error: 'Arquivo e tipo são obrigatórios' }, { status: 400 });
    }

    // Decodificar buffer do arquivo
    const buffer = Buffer.from(fileBase64, 'base64');

    // Processar EML ou MSG
    let parsedEmail;
    if (fileType === 'msg') {
      parsedEmail = await parseMSG(buffer);
    } else {
      parsedEmail = await parseEML(buffer);
    }

    // Extrair PDFs de anexos ou usar conteúdo de texto
    const { pdfAttachments, textContent } = await extractContentFromEmail(parsedEmail);

    if (pdfAttachments.length === 0 && !textContent) {
      return NextResponse.json(
        { error: 'Nenhum PDF ou conteúdo encontrado no email' },
        { status: 400 }
      );
    }

    // Se há PDFs, processar cada um
    if (pdfAttachments.length > 0) {
      const results = [];
      for (const pdfAtt of pdfAttachments) {
        const pdfBase64 = pdfAtt.buffer.toString('base64');
        const extractedData = await extractFromPDF(pdfBase64, pdfAtt.filename, cargo);
        results.push(extractedData);
      }

      if (results.length === 1) {
        return NextResponse.json(results[0]);
      }

      return NextResponse.json({ multiple: true, items: results });
    }

    // Caso contrário, extrair do conteúdo de texto/HTML do email
    const extracted = await extractFromEmailContent(textContent, fileName, cargo);
    return NextResponse.json(extracted);
  } catch (error: any) {
    console.error('Extract email error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar email', debug: error.toString() },
      { status: 500 }
    );
  }
}

async function extractFromPDF(pdfBase64: string, fileName: string, cargo: any) {
  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Resposta inesperada do Claude');

  const parsed = parseJSON(content.text);
  if (!parsed) throw new Error('Falha ao extrair dados do PDF');

  return parsed;
}

async function extractFromEmailContent(
  textContent: string,
  fileName: string,
  cargo: any
) {
  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\n═══ CONTEÚDO DO EMAIL ═══\n\n${textContent}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Resposta inesperada do Claude');

  const parsed = parseJSON(content.text);
  if (!parsed) throw new Error('Falha ao extrair dados do email');

  return parsed;
}
