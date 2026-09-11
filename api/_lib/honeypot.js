export async function getHoneypot(token) {
  try {
    const url = new URL("https://api.honeypot.is/v2/IsHoneypot");
    url.searchParams.set("address", token);
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.honeypotResult?.isHoneypot ?? null;
  } catch {
    return null;
  }
}
