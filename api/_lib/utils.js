export function calculateRisk({ liquidity, volume24h, holders, honeypot }) {
  let score = 0;
  let flags = [];

  if (liquidity < 50000) {
    score += 25;
    flags.push("Low liquidity");
  }

  if (volume24h < 10000) {
    score += 15;
    flags.push("Low volume");
  }

  if (holders < 100) {
    score += 20;
    flags.push("Low holders");
  }

  if (honeypot) {
    score += 50;
    flags.push("Honeypot detected");
  }

  let level = "SAFE";
  if (score > 70) level = "HIGH RISK";
  else if (score > 40) level = "SUSPICIOUS";

  return { score, level, flags };
}
