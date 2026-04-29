// SEC EDGAR — filings publics (10-K, 10-Q, 8-K, 13F, etc.)
// 100% gratuit, no key, mais nécessite User-Agent header. CORS-enabled.
// Doc : https://www.sec.gov/edgar/sec-api-documentation

const BASE_DATA = 'https://data.sec.gov';
const BASE_WWW = 'https://www.sec.gov';

const cache = new Map();
function memo(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

// SEC requiert un User-Agent identifiable. Browser lock-down empêche custom UA donc on s'appuie sur le default.
async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EDGAR ${res.status}`);
  return res.json();
}

// Resolve ticker → CIK (Central Index Key)
let _cikMap = null;
async function loadCikMap() {
  if (_cikMap) return _cikMap;
  const d = await get(BASE_WWW + '/files/company_tickers.json');
  _cikMap = {};
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (v.ticker) _cikMap[v.ticker.toUpperCase()] = String(v.cik_str).padStart(10, '0');
  }
  return _cikMap;
}

export async function edgarResolveCik(ticker) {
  return memo('cik:' + ticker, 60 * 60 * 1000, async () => {
    const map = await loadCikMap();
    return map[ticker.toUpperCase()] || null;
  });
}

// Submissions (filings list) pour une boîte
export async function edgarRecentFilings(ticker, formTypes = ['10-K', '10-Q', '8-K']) {
  return memo('filings:' + ticker + ':' + formTypes.join(','), 30 * 60 * 1000, async () => {
    const cik = await edgarResolveCik(ticker);
    if (!cik) return null;
    const d = await get(`${BASE_DATA}/submissions/CIK${cik}.json`);
    const recent = d.filings?.recent;
    if (!recent) return null;
    const out = [];
    for (let i = 0; i < (recent.form?.length || 0); i++) {
      if (formTypes.includes(recent.form[i])) {
        out.push({
          form: recent.form[i],
          filing_date: recent.filingDate[i],
          report_date: recent.reportDate[i],
          accession: recent.accessionNumber[i],
          primary_doc: recent.primaryDocument[i],
          url: `${BASE_WWW}/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${recent.form[i]}`,
          doc_url: `${BASE_WWW}/Archives/edgar/data/${parseInt(cik, 10)}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`
        });
      }
      if (out.length >= 8) break;
    }
    return {
      company_name: d.name,
      cik,
      sic: d.sic,
      sicDescription: d.sicDescription,
      filings: out
    };
  });
}

// Concept (data point) pour une boîte (revenue, assets, etc.)
export async function edgarCompanyFacts(ticker) {
  return memo('facts:' + ticker, 60 * 60 * 1000, async () => {
    const cik = await edgarResolveCik(ticker);
    if (!cik) return null;
    try {
      const d = await get(`${BASE_DATA}/api/xbrl/companyfacts/CIK${cik}.json`);
      const facts = d.facts?.['us-gaap'] || {};
      const out = { company: d.entityName, cik };
      // Extract key annual metrics (latest year)
      const KEYS = {
        revenue: 'Revenues',
        net_income: 'NetIncomeLoss',
        assets: 'Assets',
        liabilities: 'Liabilities',
        equity: 'StockholdersEquity',
        cash: 'CashAndCashEquivalentsAtCarryingValue'
      };
      for (const [outKey, factKey] of Object.entries(KEYS)) {
        const item = facts[factKey];
        const usd = item?.units?.USD;
        if (Array.isArray(usd) && usd.length) {
          // Get last annual (10-K) value
          const annual = usd.filter(u => u.form === '10-K').sort((a, b) => (b.end || '').localeCompare(a.end || ''))[0];
          if (annual) out[outKey] = { value: annual.val, fy: annual.fy, end: annual.end };
        }
      }
      return out;
    } catch { return null; }
  });
}
