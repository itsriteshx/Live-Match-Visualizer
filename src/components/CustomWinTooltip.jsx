export default function CustomWinTooltip({ active, payload, label, teamAShort, teamBShort }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-secondary/95 border border-white/10 rounded-lg px-4 py-3 backdrop-blur-md shadow-glow-cyan">
      <p className="text-muted text-xs mb-1 font-label font-semibold">Over {label}</p>
      <p className="text-accent-cyan font-label font-semibold">{teamAShort}: {payload[0]?.value}%</p>
      <p className="text-accent-gold font-label font-semibold">{teamBShort}: {payload[1]?.value}%</p>
    </div>
  );
}
