export function calculateRisk({ liquidity, volume24h, holders, honeypot }) {
  let score = 0;
  const flags = [];

  if (liquidity > 0 && liquidity < 50000) {
    score += 25;
    flags.push("Low liquidity");
  }
  if (volume24h > 0 && volume24h < 10000) {
    score += 15;
    flags.push("Low 24h volume");
  }
  if (holders > 0 && holders < 100) {
    score += 20;
    flags.push("Low holder count");
  }
  if (honeypot === true) {
    score += 50;
    flags.push("Honeypot detected");
  }

  score = Math.min(score, 100);
  let level = "SAFE";
  if (score > 70) level = "HIGH RISK";
  else if (score > 40) level = "SUSPICIOUS";

  return { score, level, flags };
}
