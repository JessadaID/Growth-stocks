import type { RequestHandler } from '@sveltejs/kit';

const FINNHUB_API_KEY = 'd0ost1hr01qr8ds038g0d0ost1hr01qr8ds038gg'; // <-- ใส่ API key ตรงนี้
const TECH_30 = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "INTC", "ADBE", "CRM",
  "AVGO", "AMD", "QCOM", "CSCO", "TXN", "ORCL", "NFLX", "SHOP", "UBER", "SNOW",
  "PANW", "NOW", "ZM", "DOCU", "DDOG", "PLTR", "OKTA", "TEAM", "CRWD", "ZS"
];

export const GET: RequestHandler = async () => {
  const passedStocks = [];

  for (const symbol of TECH_30) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`);
      const data = await res.json();
      const metric = data.metric;
      
      const pe = metric?.peNormalizedAnnual;
      const eps = metric?.epsTTM;
      const dividend = metric?.dividendYield;
      const de = metric?.debtToEquity;

      // เช็คเงื่อนไขพื้นฐาน
      
        passedStocks.push({
          symbol,
          pe,
          eps,
          dividend,
          debt_equity: de
        });
        
    } catch (e) {
      console.error(`Error fetching ${symbol}`, e);
    }
  }

  return new Response(JSON.stringify(passedStocks), {
    headers: { 'Content-Type': 'application/json' }
  });
};
