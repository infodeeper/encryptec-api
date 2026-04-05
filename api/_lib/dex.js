export async function getDexData(token) {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${token}`
    );
    const data = await res.json();
    const pair = data?.pairs?.[0];

    return {
      liquidity: pair?.liquidity?.usd || 0,
      volume24h: pair?.volume?.h24 || 0,
      price: pair?.priceUsd || 0
    };
  } catch {
    return { liquidity: 0, volume24h: 0, price: 0 };
  }
}
