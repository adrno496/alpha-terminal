// Etherscan — données on-chain Ethereum (balance, txs, token holders, contract source)
// Free tier : 5 req/sec, 100k req/jour. CORS-enabled.
// Doc : https://docs.etherscan.io
import { getDataKey } from '../data-keys.js';

const BASE = 'https://api.etherscan.io/api';

async function call(params) {
  const key = getDataKey('etherscan');
  if (!key) throw new Error('Etherscan key not configured');
  const url = BASE + '?' + new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Etherscan ${res.status}`);
  const data = await res.json();
  if (data.status === '0' && data.message !== 'No transactions found') {
    throw new Error('Etherscan: ' + data.result);
  }
  return data;
}

// Balance ETH d'une adresse
export async function etherscanBalance(address) {
  const d = await call({ module: 'account', action: 'balance', address, tag: 'latest' });
  if (!d.result) return null;
  return {
    address,
    balance_eth: parseInt(d.result, 10) / 1e18,
    balance_wei: d.result
  };
}

// Top tokens d'une adresse (ERC-20)
export async function etherscanTokens(address) {
  const d = await call({ module: 'account', action: 'addresstokenbalance', address, page: 1, offset: 30 });
  if (!Array.isArray(d.result)) return [];
  return d.result.slice(0, 30).map(t => ({
    name: t.TokenName,
    symbol: t.TokenSymbol,
    contract: t.TokenAddress,
    quantity: parseFloat(t.TokenQuantity || 0),
    divisor: parseInt(t.TokenDivisor || 0, 10)
  }));
}

// Transactions récentes d'une adresse
export async function etherscanRecentTxs(address, limit = 10) {
  const d = await call({ module: 'account', action: 'txlist', address, page: 1, offset: limit, sort: 'desc' });
  if (!Array.isArray(d.result)) return [];
  return d.result.slice(0, limit).map(tx => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value_eth: parseInt(tx.value, 10) / 1e18,
    gas_used: tx.gasUsed,
    timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString(),
    error: tx.isError === '1'
  }));
}

// Source code d'un contrat (utile pour Whitepaper Reader)
export async function etherscanContract(address) {
  const d = await call({ module: 'contract', action: 'getsourcecode', address });
  if (!Array.isArray(d.result) || !d.result[0]) return null;
  const c = d.result[0];
  return {
    address,
    name: c.ContractName,
    compiler: c.CompilerVersion,
    optimization: c.OptimizationUsed === '1',
    license: c.LicenseType,
    proxy: c.Proxy === '1',
    implementation: c.Implementation || null,
    is_verified: !!c.SourceCode,
    source_excerpt: (c.SourceCode || '').slice(0, 800)
  };
}

// Gas tracker
export async function etherscanGas() {
  const d = await call({ module: 'gastracker', action: 'gasoracle' });
  if (!d.result) return null;
  return {
    safe_low: parseInt(d.result.SafeGasPrice, 10),
    standard: parseInt(d.result.ProposeGasPrice, 10),
    fast: parseInt(d.result.FastGasPrice, 10),
    base_fee: parseFloat(d.result.suggestBaseFee)
  };
}
