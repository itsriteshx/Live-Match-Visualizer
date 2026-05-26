export function getBallClass(ball) {
  if (ball === '0') return 'bg-[#2a2a2a] text-[#666]';
  if (ball === '1') return 'bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan';
  if (ball === '2') return 'bg-accent-cyan/25 border border-accent-cyan/40 text-accent-cyan';
  if (ball === '3') return 'bg-accent-cyan/35 border border-accent-cyan/50 text-accent-cyan';
  if (ball === '4') return 'bg-accent-green/20 border border-accent-green/50 text-accent-green shadow-glow-green';
  if (ball === '6') return 'bg-accent-gold/20 border border-accent-gold/50 text-accent-gold shadow-glow-gold scale-110';
  if (ball === 'W') return 'bg-accent-red/20 border border-accent-red/50 text-accent-red shadow-glow-red animate-wicket-shake';
  if (ball === 'WD' || ball === 'NB') return 'bg-accent-purple/20 border border-accent-purple/40 text-accent-purple';
  return 'bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan';
}

export function formatOvers(overs, balls) {
  return overs + balls / 6;
}

export function computeCrr(score, overs, balls) {
  const total = overs + balls / 6;
  return total > 0 ? (score / total).toFixed(2) : '0.00';
}

export function computeRrr(score, target, overs, balls) {
  const total = overs + balls / 6;
  const remaining = 20 - total;
  const needed = target - score;
  return remaining > 0 ? (needed / remaining).toFixed(2) : '0.00';
}
