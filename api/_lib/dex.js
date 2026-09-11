export async function getDexData(token) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error(`DEX Screener HTTP ${res.status}`);
    const data = await res.json();
    const pair = Array.isArray(data?.pairs) ? data.pairs[0] : null;
    return {
      liquidity: Number(pair?.liquidity?.usd || 0),
      volume24h: Number(pair?.volume?.h24 || 0),
      price: Number(pair?.priceUsd || 0),
      pairAddress: pair?.pairAddress || null,
      dexId: pair?.dexId || null
    };
  } catch {
    return { liquidity: 0, volume24h: 0, price: 0, pairAddress: null, dexId: null };
  }
}
