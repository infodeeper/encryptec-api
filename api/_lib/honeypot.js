export async function getHoneypot(token) {
  try {
    const res = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${token}`
    );

    const data = await res.json();
    return data?.honeypotResult?.isHoneypot || false;
  } catch {
    return false;
  }
}
