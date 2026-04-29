// FRED API — indicateurs macro US (Federal Reserve Economic Data)
// Free, illimité avec clé. CORS-enabled.
// Doc : https://fred.stlouisfed.org/docs/api/fred/
import { getDataKey } from '../data-keys.js';

const BASE = 'https://api.stlouisfed.org/fred';

async function call(path, params = {}) {
  const key = getDataKey('fred');
  if (!key) throw new Error('FRED key not configured');
  const url = BASE + path + '?' + new URLSearchParams({ ...params, api_key: key, file_type: 'json' });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${res.status}`);
  return res.json();
}

// Récupère la dernière valeur d'une série
export async function fredLatest(seriesId) {
  const d = await call('/series/observations', {
    series_id: seriesId,
    sort_order: 'desc',
    limit: 1
  });
  const obs = d.observations?.[0];
  if (!obs) return null;
  return { date: obs.date, value: parseFloat(obs.value) };
}

// Snapshot macro US — séries clés en parallèle
export async function fredMacroSnapshot() {
  const series = {
    'fed_funds':       'DFF',          // Effective Fed Funds Rate
    'cpi_yoy':         'CPIAUCSL',     // CPI All Urban Consumers (need YoY calc, but raw level for now)
    'unemployment':    'UNRATE',       // Civilian Unemployment Rate
    'us10y':           'DGS10',        // 10-Year Treasury
    'us2y':            'DGS2',         // 2-Year Treasury
    'real_gdp':        'A191RL1Q225SBEA', // Real GDP YoY % change
    'pce':             'PCEPI',        // PCE
    'm2':              'M2SL',         // M2 Money Stock
    'usd_index':       'DTWEXBGS',     // Trade-Weighted USD index
    'vix':             'VIXCLS',       // VIX
    'high_yield_spread': 'BAMLH0A0HYM2',// HY OAS (bps)
    'wti_oil':         'DCOILWTICO'    // WTI crude
  };
  const out = {};
  // Run in parallel for speed
  await Promise.all(Object.entries(series).map(async ([key, id]) => {
    try {
      const r = await fredLatest(id);
      if (r) out[key] = r;
    } catch {}
  }));
  // Compute spread 10y-2y
  if (out.us10y && out.us2y) {
    out.yield_curve_spread = { value: out.us10y.value - out.us2y.value, date: out.us10y.date };
  }
  return out;
}
