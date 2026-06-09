import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { parseEML, parseMSG, extractContentFromEmail } from '@/lib/email-parser';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `INSTRUÇÕES: Retorne SOMENTE JSON válido. Zero texto antes ou depois. Zero comentários.

Extraia TODOS os dados do email de solicitação de cotação de frete.

CÁLCULOS:
Se houver dimensões em CM: peso_cubado = (comp × larg × alt × qtd) / 6000
volume_total_m3 = (comp_cm × larg_cm × alt_cm × qtd) / 1000000
billedWeight = max(peso_bruto_total, peso_cubado_total)

FORMATO:
{
  "clientName": "nome do cliente/empresa que solicitou o frete (quem enviou a carga)",
  "clientRef": "referência/processo/PO se houver",
  "origin": "cidade/país de origem ou endereço de coleta (ex: 'Wuxi, China', 'Dalian, China')",
  "destination": "porto ou aeroporto de destino (ex: 'Santos, Brasil', 'GRU, Brasil', 'Viracopos, Brasil')",
  "weight": número (peso bruto total em kg),
  "measurement": número (volume total em m³),
  "qtyVolumes": número (quantidade de volumes/caixas),
  "dimensions": [
    { "qty": número, "length": número (cm), "width": número (cm), "height": número (cm) }
  ],
  "containerType": "tipo de container para FCL: '20DRY', '40DRY', '40HC', '45HC', 'REEFER' — null se não for FCL",
  "containerQty": número de containers (ex: 1, 2, 3) — null se não for FCL,
  "commodityType": "descrição da mercadoria/carga",
  "ncm": "código NCM se houver",
  "merchandiseValue": "valor da mercadoria com moeda (ex: EUR 1.968.780)",
  "desiredModal": "AEREO" ou "FCL" ou "LCL" ou null,
  "incoterm": "EXW" ou outro ou null,
  "readyDate": "data a partir quando pode coletar (YYYY-MM-DD)",
  "etaMaximo": "prazo máximo de entrega (YYYY-MM-DD)",
  "desiredTransitDays": número ou null,
  "observations": "observações ou restrições especiais",
  "billedWeight": número (max entre peso bruto e peso cubado)
}

MODAL: AEREO=AIR/AOL/AOD/aeroporto | FCL=container/B/L | LCL=CBM/grupagem
Retorne apenas o JSON, sem explicações.`;

function parseJSON(text: string): any {
  let t = text.trim();
  if (t.startsWith('```json')) t = t.slice(7);
  else if (t.startsWith('```')) t = t.slice(3);
  if (t.endsWith('```')) t = t.slice(0, -3);
  t = t.trim();
  try { return JSON.parse(t); } catch {}
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s !== -1 && e > s) return JSON.parse(t.slice(s, e + 1));
  throw new Error('No valid JSON');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfBase64, fileBase64, fileType } = body;

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    let messageContent: Anthropic.MessageParam['content'];

    if (fileBase64 && fileType) {
      // Email (EML ou MSG): extrair texto do corpo
      const buffer = Buffer.from(fileBase64, 'base64');
      const parsed = fileType === 'msg' ? await parseMSG(buffer) : await parseEML(buffer);
      const { textContent } = await extractContentFromEmail(parsed);

      if (!textContent) return NextResponse.json({ error: 'Nenhum conteúdo encontrado no email' }, { status: 400 });

      messageContent = `${PROMPT}\n\n═══ CONTEÚDO DO EMAIL ═══\n\n${textContent}`;
    } else if (pdfBase64) {
      messageContent = [
        { type: 'text', text: PROMPT },
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
      ];
    } else {
      return NextResponse.json({ error: 'Arquivo não fornecido' }, { status: 400 });
    }

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: messageContent }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return NextResponse.json({ error: 'Resposta inesperada' }, { status: 500 });

    try {
      const data = parseJSON(content.text);
      return NextResponse.json(data);
    } catch {
      console.error('extract-request JSON error:', content.text.slice(0, 500));
      return NextResponse.json({ error: 'Resposta do Claude não é JSON válido' }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
