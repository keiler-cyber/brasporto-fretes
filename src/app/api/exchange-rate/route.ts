import { NextRequest, NextResponse } from 'next/server';

// Busca cotação da moeda no BCB PTAX para uma data específica (formato MM/DD/YYYY)
async function fetchPtax(currency: string, dateMDY: string): Promise<number | null> {
  const url =
    `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
    `CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)` +
    `?@moeda=%27${currency}%27&@dataCotacao=%27${dateMDY}%27` +
    `&%24top=1&%24format=json&%24select=cotacaoVenda`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const json = await res.json();
  const venda = json?.value?.[0]?.cotacaoVenda;
  return typeof venda === 'number' && venda > 0 ? venda : null;
}

// Tenta a data mais recente disponível (recua até 5 dias úteis para cobrir feriados e fins de semana)
async function fetchPtaxRecent(currency: string): Promise<{ rate: number; date: string } | null> {
  const now = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    // Pula fins de semana
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    const dateMDY = `${mm}/${dd}/${yyyy}`;
    const dateISO = `${yyyy}-${mm}-${dd}`;
    const rate = await fetchPtax(currency, dateMDY);
    if (rate !== null) return { rate, date: dateISO };
  }
  return null;
}

// GET /api/exchange-rate?from=SEK&to=EUR
// Retorna a taxa de conversão from→to usando o BCB PTAX como referência
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from')?.toUpperCase();
  const to = (req.nextUrl.searchParams.get('to') ?? 'EUR').toUpperCase();

  if (!from) {
    return NextResponse.json({ error: 'Parâmetro "from" obrigatório' }, { status: 400 });
  }
  if (from === to) {
    return NextResponse.json({ rate: 1, source: 'identidade', date: new Date().toISOString().slice(0, 10) });
  }

  try {
    // Para calcular from→to via BRL: taxa = from_BRL / to_BRL
    const [fromResult, toResult] = await Promise.all([
      fetchPtaxRecent(from),
      fetchPtaxRecent(to),
    ]);

    if (!fromResult) {
      return NextResponse.json({ error: `Moeda ${from} não encontrada no BCB PTAX` }, { status: 404 });
    }
    if (!toResult) {
      return NextResponse.json({ error: `Moeda ${to} não encontrada no BCB PTAX` }, { status: 404 });
    }

    // from_BRL / to_BRL = unidades de "to" por 1 unidade de "from"
    const rate = fromResult.rate / toResult.rate;

    return NextResponse.json({
      rate: parseFloat(rate.toFixed(6)),
      from,
      to,
      fromBRL: fromResult.rate,
      toBRL: toResult.rate,
      date: fromResult.date,
      source: 'BCB PTAX',
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao consultar BCB PTAX' }, { status: 502 });
  }
}
