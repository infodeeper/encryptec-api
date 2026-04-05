export async function getHolders(token) {
  try {
    const res = await fetch(
      `https://api.etherscan.io/api?module=token&action=tokenholdercount&contractaddress=${token}&apikey=${process.env.ETHERSCAN_API_KEY}`
    );

    const data = await res.json();
    return Number(data.result || 0);
  } catch {
    return 0;
  }
}
