const BASE_URL = "https://api.opensanctions.org";

function normalizeMatch(item) {
  return {
    id: item?.id || null,
    caption: item?.caption || null,
    score: Number(item?.score || 0),
    schema: item?.schema || null,
    datasets: Array.isArray(item?.datasets) ? item.datasets : [],
    topics: Array.isArray(item?.properties?.topics) ? item.properties.topics : [],
    programId: Array.isArray(item?.properties?.programId) ? item.properties.programId : [],
    name: Array.isArray(item?.properties?.name) ? item.properties.name : []
  };
}

export async function screenCryptoWallet(address) {
  const apiKey = process.env.OPENSANCTIONS_API_KEY;

  if (!apiKey) {
    return {
      status: "not_checked",
      matches: [],
      reason: "OPENSANCTIONS_API_KEY is not configured",
      source: "OpenSanctions"
    };
  }

  const endpoint = process.env.OPENSANCTIONS_URL || `${BASE_URL}/match/default`;
  const threshold = Number(process.env.OPENSANCTIONS_THRESHOLD || 0.85);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${apiKey}`
      },
      body: JSON.stringify({
        queries: {
          wallet: {
            schema: "CryptoWallet",
            properties: {
              publicKey: [address]
            }
          }
        },
        topics: ["sanction", "sanction.linked", "debarment", "role.pep"]
      })
    });

    if (!response.ok) {
      return {
        status: "not_checked",
        matches: [],
        reason: `OpenSanctions HTTP ${response.status}`,
        source: "OpenSanctions"
      };
    }

    const data = await response.json();
    const results = data?.responses?.wallet?.results;
    if (!Array.isArray(results)) {
      return {
        status: "not_checked",
        matches: [],
        reason: "OpenSanctions returned an unexpected response",
        source: "OpenSanctions"
      };
    }

    const matches = results
      .map(normalizeMatch)
      .filter((item) => item.score >= threshold);

    return {
      status: matches.length ? "detected" : "clear",
      matches,
      threshold,
      source: "OpenSanctions"
    };
  } catch (error) {
    return {
      status: "not_checked",
      matches: [],
      reason: error?.message || "OpenSanctions request failed",
      source: "OpenSanctions"
    };
  }
}
