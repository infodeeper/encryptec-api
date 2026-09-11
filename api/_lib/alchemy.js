const MAX_PAGES = Number(process.env.ALCHEMY_MAX_PAGES || 10);
const PAGE_SIZE = Number(process.env.ALCHEMY_PAGE_SIZE || 100);
const REQUEST_TIMEOUT_MS = Number(process.env.ALCHEMY_TIMEOUT_MS || 12000);

const NETWORK_ENV = {
  ethereum: "ALCHEMY_ETHEREUM_URL",
  polygon: "ALCHEMY_POLYGON_URL",
  arbitrum: "ALCHEMY_ARBITRUM_URL",
  base: "ALCHEMY_BASE_URL",
  bsc: "ALCHEMY_BSC_URL"
};

function timeoutSignal(ms) {
  return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
}

export function normalizeNetwork(value) {
  const network = String(value || "").trim().toLowerCase();
  const aliases = {
    eth: "ethereum",
    ethereum: "ethereum",
    mainnet: "ethereum",
    bsc: "bsc",
    "bnb chain": "bsc",
    bnb: "bsc",
    polygon: "polygon",
    matic: "polygon",
    arbitrum: "arbitrum",
    "arbitrum one": "arbitrum",
    base: "base",
    auto: "auto",
    "auto-detect": "auto"
  };
  return aliases[network] || network;
}

export function getAlchemyUrl(network) {
  const envName = NETWORK_ENV[network];
  if (envName && process.env[envName]) return process.env[envName];
  if (network === "ethereum" && process.env.ALCHEMY_URL) return process.env.ALCHEMY_URL;
  return null;
}

async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal: timeoutSignal(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) throw new Error(`Alchemy HTTP ${response.status}`);
  const data = await response.json();
  if (data?.error) throw new Error(data.error.message || `Alchemy RPC error: ${data.error.code}`);
  return data?.result;
}

export async function getNativeBalance(url, address) {
  const result = await rpc(url, "eth_getBalance", [address, "latest"]);
  return Number(BigInt(result || "0x0")) / 1e18;
}

export async function getTransfers(url, address, direction) {
  const all = [];
  let pageKey;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = {
      fromBlock: "0x0",
      toBlock: "latest",
      category: ["external", "internal", "erc20"],
      withMetadata: true,
      maxCount: `0x${PAGE_SIZE.toString(16)}`
    };

    if (direction === "outgoing") params.fromAddress = address;
    else params.toAddress = address;
    if (pageKey) params.pageKey = pageKey;

    const result = await rpc(url, "alchemy_getAssetTransfers", [params]);
    const transfers = Array.isArray(result?.transfers) ? result.transfers : [];
    all.push(...transfers);

    if (!result?.pageKey || transfers.length === 0) break;
    pageKey = result.pageKey;
  }

  return all;
}

export async function getCode(url, address) {
  try {
    const result = await rpc(url, "eth_getCode", [address, "latest"]);
    return result && result !== "0x";
  } catch {
    return null;
  }
}

export function validateEvmAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function normalizeAddress(address) {
  return String(address || "").trim();
}
