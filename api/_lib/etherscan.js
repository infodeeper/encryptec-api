export async function getHolders(token) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return 0;

  try {
    const url = new URL("https://api.etherscan.io/api");
    url.searchParams.set("module", "token");
    url.searchParams.set("action", "tokenholdercount");
    url.searchParams.set("contractaddress", token);
    url.searchParams.set("apikey", apiKey);

    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data?.result || 0);
  } catch {
    return 0;
  }
}
