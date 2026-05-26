import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, ReferenceLine
} from 'recharts';
import {
  Zap, Target, TrendingUp, AlertTriangle, Users, Activity,
  CircleDot, ChevronDown
} from 'lucide-react';
import { useInterval } from './hooks/useInterval.js';
import { useLiveCricket } from './hooks/useLiveCricket.js';
import { API_STATUS } from './data/constants.js';
import { ZONES } from './data/constants.js';
import { getBallClass, formatOvers, computeCrr, computeRrr } from './utils/cricket.js';
import CustomWinTooltip from './components/CustomWinTooltip.jsx';

function ApiStatusBadge({ status, countdown, errorMessage }) {
  const map = {
    [API_STATUS.LIVE]: { text: '● LIVE', cls: 'text-accent-green border-accent-green/40' },
    [API_STATUS.CRICAPI]: { text: '● LIVE CRICAPI', cls: 'text-accent-green border-accent-green/40' },
    [API_STATUS.CACHED]: { text: '● CACHED', cls: 'text-accent-gold border-accent-gold/40' },
    [API_STATUS.LOADING]: { text: '● LOADING…', cls: 'text-accent-cyan border-accent-cyan/40' },
    [API_STATUS.ERROR]: { text: '● API ERROR', cls: 'text-accent-red border-accent-red/40' },
    [API_STATUS.RECONNECTING]: { text: `● RECONNECTING ${countdown}s`, cls: 'text-accent-red border-accent-red/40' },
  };
  const cfg = map[status] || map[API_STATUS.LOADING];
  return (
    <div className="flex flex-col gap-1 max-w-md">
      <span className={`font-display font-bold text-[10px] tracking-wider px-2.5 py-1 rounded-full border w-fit ${cfg.cls}`}>
        {cfg.text}
      </span>
      {errorMessage && (status === API_STATUS.ERROR || status === API_STATUS.CACHED) && (
        <span className="text-[10px] text-accent-red/90 font-body leading-tight" title={errorMessage}>
          {errorMessage}
        </span>
      )}
    </div>
  );
}

export default function App() {
  const {
    matchState,
    liveMatches,
    selectedMatchId,
    selectMatch,
    apiStatus,
    apiErrorMessage,
    reconnectCountdown,
    loading,
    lastUpdated,
    dataTransition,
    scorePulse,
  } = useLiveCricket();

  const [secondsAgo, setSecondsAgo] = useState(0);
  const [wagonFilter, setWagonFilter] = useState('All');
  const [heatmapView, setHeatmapView] = useState('batting');
  const [insightIndex, setInsightIndex] = useState(0);
  const [hoveredTimeline, setHoveredTimeline] = useState(null);
  const timelineRef = useRef(null);

  useInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000)), 1000);
  useInterval(() => setInsightIndex((i) => (i + 1) % 3), 8000);

  useEffect(() => {
    if (timelineRef.current) timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
  }, [matchState.events.length]);

  const crr = useMemo(() => {
    if (matchState.crr != null) return Number(matchState.crr).toFixed(2);
    return computeCrr(matchState.score, matchState.overs, matchState.balls);
  }, [matchState.crr, matchState.score, matchState.overs, matchState.balls]);

  const rrr = useMemo(() => {
    if (matchState.target == null) return '—';
    if (matchState.rrr != null) return Number(matchState.rrr).toFixed(2);
    return computeRrr(matchState.score, matchState.target, matchState.overs, matchState.balls);
  }, [matchState.rrr, matchState.score, matchState.target, matchState.overs, matchState.balls]);

  const derivedMood = useMemo(() => {
    const crrNum = parseFloat(crr);
    const rrrNum = parseFloat(rrr);
    const recentWickets = matchState.allOvers.slice(-5).reduce((s, o) => s + o.wickets, 0);

    if (recentWickets >= 3) return { mood: 'collapse', emoji: '⚠️', label: 'COLLAPSE', reason: `${recentWickets} wickets in last 5 overs`, cssClass: 'shadow-glow-red animate-glow-pulse-red-fast' };
    if (crrNum > rrrNum + 3) return { mood: 'dominating', emoji: '💀', label: 'DOMINATING', reason: `CRR ${crr} well above RRR ${rrr}`, cssClass: 'shadow-glow-gold animate-glow-pulse-gold' };
    if (rrrNum > crrNum + 2) return { mood: 'tense', emoji: '😬', label: 'TENSE', reason: `RRR ${rrr} climbing above CRR ${crr}`, cssClass: 'shadow-glow-red animate-glow-pulse-red' };
    if (recentWickets === 0 && crrNum > rrrNum) return { mood: 'comeback', emoji: '🔥', label: 'COMEBACK', reason: 'No wickets lost, SR rising steadily', cssClass: 'shadow-glow-green animate-glow-pulse-green' };
    return { mood: 'stable', emoji: '😌', label: 'STABLE', reason: `CRR ${crr} tracking near RRR ${rrr}`, cssClass: 'shadow-[0_0_12px_rgba(0,229,255,0.2)]' };
  }, [crr, rrr, matchState.allOvers]);

  const activeInsights = useMemo(() => {
    const crrNum = parseFloat(crr);
    const rrrNum = parseFloat(rrr);
    const insights = [];

    if (rrrNum > 12) insights.push({ icon: 'alert', text: `Required rate now asking ${rrr}+ per over — very steep`, tag: 'Run Rate', confidence: 85 });
    else insights.push({ icon: 'trending', text: `Run rate ${crr} is ${crrNum > rrrNum ? 'above' : 'below'} required ${rrr}`, tag: 'Run Rate', confidence: 70 });

    const deathOvers = matchState.allOvers.filter((o) => o.over > 15);
    const deathEconomy = deathOvers.reduce((s, o) => s + o.runs, 0) / Math.max(1, deathOvers.length);
    if (deathOvers.length) {
      insights.push({ icon: 'target', text: `Death overs economy: ${deathEconomy.toFixed(1)} — ${deathEconomy > 10 ? 'very poor' : 'controlled'}`, tag: 'Bowling Pattern', confidence: deathEconomy > 10 ? 90 : 60 });
    } else {
      insights.push({ icon: 'target', text: `Spinners account for ${Math.floor(matchState.wickets * 0.6)} of ${matchState.wickets} wickets`, tag: 'Bowling Pattern', confidence: 65 });
    }

    if (matchState.partnership.runs > 50) {
      insights.push({ icon: 'trending', text: `${matchState.partnership.runs}-run partnership building pressure on bowlers`, tag: 'Partnership', confidence: 80 });
    } else {
      insights.push({ icon: 'trending', text: `Momentum shifted after over ${Math.max(1, matchState.overs - 3)} — ${matchState.lastFiveOversRuns} runs in last 5`, tag: 'Batting Trend', confidence: 72 });
    }

    return insights;
  }, [crr, rrr, matchState]);

  const visibleInsight = activeInsights[insightIndex % activeInsights.length];

  const dotBallPct = useMemo(() => (
    matchState.totalBalls > 0 ? Math.round((matchState.dots / matchState.totalBalls) * 100) : 0
  ), [matchState.dots, matchState.totalBalls]);

  const filteredShots = useMemo(() => {
    if (wagonFilter === 'All') return matchState.wagonWheelShots;
    if (wagonFilter === 'Boundaries') return matchState.wagonWheelShots.filter((s) => s.runs >= 4);
    if (wagonFilter === 'Dots') return matchState.wagonWheelShots.filter((s) => s.runs === 0);
    if (wagonFilter === 'Singles') return matchState.wagonWheelShots.filter((s) => s.runs <= 1);
    return matchState.wagonWheelShots;
  }, [matchState.wagonWheelShots, wagonFilter]);

  function getOverBadge(over) {
    if (over.runs >= 15) return { label: '🔥 TURNING', cls: 'bg-accent-gold/20 text-accent-gold' };
    if (over.wickets >= 2) return { label: '💀 COLLAPSE', cls: 'bg-accent-red/20 text-accent-red' };
    if (over.runs <= 4 && over.wickets === 0) return { label: '💤 QUIET', cls: 'bg-white/5 text-muted' };
    if (over.over <= 6 && over.runs >= 10) return { label: '⚡ POWER', cls: 'bg-accent-cyan/20 text-accent-cyan' };
    return null;
  }

  function getEcoClass(runs) {
    if (runs <= 5) return 'text-accent-green border-accent-green/20';
    if (runs <= 9) return 'text-accent-cyan border-accent-cyan/20';
    return 'text-accent-red border-accent-red/20';
  }

  const radarData = useMemo(() => (
    matchState.matchDNA.a.map((item, i) => ({
      axis: item.axis,
      teamA: item.val,
      teamB: matchState.matchDNA.b[i].val,
    }))
  ), [matchState.matchDNA]);

  const oversFloat = formatOvers(matchState.overs, matchState.balls);

  const matchOptions = useMemo(() => {
    return liveMatches.map((m) => ({ id: m.matchId, label: m.label }));
  }, [liveMatches]);

  const tooltipContent = useCallback((props) => (
    <CustomWinTooltip
      {...props}
      teamAShort={matchState.teams.a.short}
      teamBShort={matchState.teams.b.short}
    />
  ), [matchState.teams.a.short, matchState.teams.b.short]);

  if (loading && !matchState.matchId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <ApiStatusBadge status={API_STATUS.LOADING} countdown={0} errorMessage={null} />
        <p className="font-label text-muted">Fetching live matches from CricAPI…</p>
      </div>
    );
  }

  return (
    <>
      <div className={`max-w-7xl mx-auto p-6 pb-20 flex flex-col gap-8 relative transition-opacity duration-400 ${dataTransition ? 'opacity-40' : 'opacity-100'}`}>

        {/* TOP BAR */}
        <div className="glass-panel px-5 py-4 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <ApiStatusBadge status={apiStatus} countdown={reconnectCountdown} errorMessage={apiErrorMessage} />
            {loading && <span className="text-[11px] text-accent-cyan font-label animate-pulse">Updating…</span>}
          </div>
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <select
              className="w-full appearance-none bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 pr-10 font-label font-semibold text-sm text-white cursor-pointer hover:border-accent-cyan/40 transition-colors"
              value={selectedMatchId || ''}
              onChange={(e) => selectMatch(e.target.value)}
              disabled={!matchOptions.length}
            >
              {matchOptions.length === 0 && (
                <option value="" className="bg-primary text-white">Loading matches…</option>
              )}
              {matchOptions.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-primary text-white">{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
          <div className="text-[11px] text-muted font-body">Last updated: {secondsAgo}s ago</div>
        </div>

        {/* HERO SCOREBOARD */}
        <div className="glass-panel min-h-[220px] flex max-sm:flex-col items-center justify-between px-10 py-7 relative overflow-hidden bg-gradient-to-br from-[#0a1628]/90 to-[#05080f]/95 animate-mesh-drift">
          <div className="absolute top-4 right-5 flex items-center gap-2 font-display font-bold text-xs tracking-wider">
            <span className={`w-2.5 h-2.5 rounded-full ${matchState.matchEnded ? 'bg-muted' : 'bg-accent-red animate-live-pulse'}`} />
            <span className={matchState.matchEnded ? 'text-muted' : 'text-accent-red'}>
              {matchState.matchEnded ? 'RESULT' : matchState.matchStarted ? 'LIVE' : 'MATCH'}
            </span>
          </div>

          <div className="flex items-center gap-4 flex-1 max-sm:order-2 max-sm:mt-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-sm text-white border-2 shadow-glow-cyan" style={{ borderColor: matchState.teams.a.color }}>
              {matchState.teams.a.short}
            </div>
            <div>
              <div className="font-label font-bold text-[22px] text-white tracking-[0.5px]">{matchState.teams.a.name}</div>
              <div className="text-[12px] text-muted font-body mt-0.5">{matchState.venue}</div>
            </div>
          </div>

          <div className="text-center flex-[2] max-sm:order-1">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
              {matchState.seriesName && (
                <span className="font-label font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold border border-accent-gold/30">{matchState.seriesName}</span>
              )}
              {matchState.matchNumber && (
                <span className="font-label font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-white/5 text-muted border border-white/10">{matchState.matchNumber}</span>
              )}
            </div>
            <div className={`font-display font-black text-7xl max-lg:text-5xl max-sm:text-[40px] text-accent-gold drop-shadow-[0_0_20px_rgba(255,208,0,0.4)] leading-none tracking-[2px] transition-all duration-500 ${scorePulse ? 'animate-score-pulse' : ''}`}>
              <span key={matchState.score} className="inline-block animate-score-slide-in">{matchState.score}</span>
              <span className="text-white/60"> / </span>
              <span>{matchState.wickets}</span>
            </div>
            <div className="font-display font-semibold text-2xl max-lg:text-lg text-accent-cyan drop-shadow-[0_0_20px_rgba(0,229,255,0.4)] mt-2 tracking-[1px]">
              {oversFloat.toFixed(1)} OVERS
            </div>
          </div>

          <div className="flex flex-col items-end max-sm:items-center gap-2 flex-1 max-sm:order-3 max-sm:mt-4">
            <div className={`font-label font-semibold text-sm px-3.5 py-1 rounded-full bg-white/5 border border-white/10 ${parseFloat(crr) >= parseFloat(rrr) ? 'text-accent-green border-accent-green/30' : 'text-accent-cyan'}`}>
              CRR: {crr}
            </div>
            <div className={`font-label font-semibold text-sm px-3.5 py-1 rounded-full bg-white/5 border border-white/10 ${parseFloat(rrr) > 10 ? 'text-accent-red border-accent-red/30' : 'text-accent-cyan'}`}>
              RRR: {rrr}
            </div>
            <div className="font-label font-medium text-[13px] text-muted">
              {matchState.target != null
                ? <>Target: {matchState.target} | Need: {Math.max(0, matchState.target - matchState.score)}</>
                : <>{matchState.statusText || 'In progress'}</>}
            </div>
          </div>
        </div>

        {/* BALL TRACKER */}
        <div className="glass-panel p-7 group">
          <h3 className="font-display font-bold text-[14px] text-accent-cyan tracking-[1.5px] uppercase mb-[18px]">Current Over</h3>
          <div className="flex gap-3 items-center flex-wrap mb-5">
            {matchState.currentOver.map((ball, i) => (
              <div key={i} className={`w-[52px] h-[52px] rounded-full flex items-center justify-center font-display font-bold text-base transition-all duration-200 animate-ball-slide-in hover:scale-110 cursor-default ${getBallClass(ball)}`} style={{ animationDelay: `${i * 50}ms` }}>
                {ball}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 6 - matchState.currentOver.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="w-[52px] h-[52px] rounded-full flex items-center justify-center font-display font-bold text-base bg-[#2a2a2a] text-[#666] opacity-20 transition-opacity group-hover:opacity-40">•</div>
            ))}
          </div>
          <h3 className="text-xs mb-2.5 mt-1.5 opacity-70 font-display font-bold tracking-wider text-accent-cyan uppercase">LAST 5 OVERS</h3>
          <div className="flex gap-2.5 flex-wrap">
            {matchState.allOvers.slice(-5).map((ov, i) => (
              <div key={i} className={`font-label font-semibold text-[13px] px-3 py-1 rounded-xl bg-white/5 border hover:bg-white/10 transition-colors cursor-default ${getEcoClass(ov.runs)}`}>
                Ov {ov.over}: {ov.runs}({ov.wickets})
              </div>
            ))}
          </div>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
          {[
            { icon: Users, val: matchState.partnership.runs, sub: `(${matchState.partnership.balls})`, label: 'Partnership' },
            { icon: Activity, val: matchState.lastFiveOversRuns, sub: '', label: 'Last 5 Overs Runs' },
            { icon: Zap, val: `${matchState.fours} / ${matchState.sixes}`, sub: ' (4s/6s)', label: 'Boundaries' },
            { icon: CircleDot, val: `${dotBallPct}%`, sub: '', label: 'Dot Ball %' },
          ].map((stat, i) => (
            <div key={i} className="glass-panel p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <stat.icon size={20} className="text-accent-cyan mb-2.5" />
              <div className="font-display font-bold text-4xl text-white leading-[1.1]">
                {stat.val}<span className="text-base text-muted ml-1">{stat.sub}</span>
              </div>
              <div className="font-label font-semibold text-sm text-muted mt-1.5 uppercase tracking-[0.5px]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* WAGON WHEEL + HEATMAP */}
        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
          <div className="glass-panel p-5">
            <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-4">🎯 Wagon Wheel</h3>
            <svg viewBox="0 0 500 400" className="w-full max-h-[400px]">
              <ellipse cx="250" cy="200" rx="230" ry="180" fill="none" stroke="rgba(0,230,118,0.15)" strokeWidth="2" />
              <ellipse cx="250" cy="200" rx="160" ry="120" fill="none" stroke="rgba(0,230,118,0.08)" strokeWidth="1" strokeDasharray="4,4" />
              <rect x="240" y="170" width="20" height="60" fill="rgba(139,119,72,0.3)" stroke="rgba(139,119,72,0.5)" strokeWidth="1" rx="2" />
              {filteredShots.map((shot, i) => {
                const endX = 250 + Math.cos(shot.angle) * shot.distance * 210;
                const endY = 200 + Math.sin(shot.angle) * shot.distance * 170;
                const isSix = shot.runs === 6;
                const isFour = shot.runs === 4;
                return (
                  <line key={i} x1="250" y1="200" x2={endX} y2={endY}
                    stroke={isSix ? '#ffd000' : isFour ? '#00e676' : '#00e5ff'}
                    strokeWidth={isSix ? 2.5 : isFour ? 1.8 : 1}
                    opacity={isSix ? 0.9 : isFour ? 0.7 : 0.4}
                    strokeLinecap="round">
                    <title>{shot.shot} | {shot.runs} runs | {shot.zone}</title>
                  </line>
                );
              })}
              <circle cx="250" cy="200" r="4" fill="#00e5ff" />
            </svg>
            <div className="flex gap-2 mt-3">
              {['All', 'Boundaries', 'Singles', 'Dots'].map((f) => (
                <button key={f} type="button" className={`font-label font-semibold text-xs px-3.5 py-1.5 rounded-2xl border transition-all ${wagonFilter === f ? 'bg-accent-gold text-black border-accent-gold' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:text-white'}`} onClick={() => setWagonFilter(f)}>{f}</button>
              ))}
            </div>
          </div>

          <div className="glass-panel p-5">
            <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-4">🔥 Scoring Heatmap</h3>
            <svg viewBox="0 0 500 400" className="w-full max-h-[400px]">
              <ellipse cx="250" cy="200" rx="230" ry="180" fill="none" stroke="rgba(0,230,118,0.15)" strokeWidth="2" />
              {ZONES.map((zone, i) => {
                const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2;
                const nextAngle = (Math.PI * 2 * (i + 1)) / 8 - Math.PI / 2;
                const midAngle = (angle + nextAngle) / 2;
                const r = matchState.zoneRuns[zone] || 0;
                const runs = heatmapView === 'batting' ? r : Math.max(0, 40 - r);
                const color = runs > 30 ? '#ff4444' : runs > 15 ? '#ff8800' : runs > 5 ? '#0088ff' : '#112244';
                const opacity = runs > 30 ? 0.7 : runs > 15 ? 0.5 : runs > 5 ? 0.4 : 0.3;
                return (
                  <g key={zone}>
                    <path d={`M 250 200 L ${250 + Math.cos(angle) * 230} ${200 + Math.sin(angle) * 180} A 230 180 0 0 1 ${250 + Math.cos(nextAngle) * 230} ${200 + Math.sin(nextAngle) * 180} Z`} fill={color} opacity={opacity} stroke="rgba(255,255,255,0.1)" strokeWidth="1">
                      <title>{zone}: {r} runs</title>
                    </path>
                    <text x={250 + Math.cos(midAngle) * 140} y={200 + Math.sin(midAngle) * 110} fill="#fff" fontSize="10" fontFamily="Rajdhani" fontWeight="600" textAnchor="middle" dominantBaseline="middle" opacity="0.8">{zone}</text>
                    <text x={250 + Math.cos(midAngle) * 140} y={200 + Math.sin(midAngle) * 110 + 14} fill="#fff" fontSize="13" fontFamily="Orbitron" fontWeight="700" textAnchor="middle" dominantBaseline="middle" opacity="0.9">{r}</text>
                  </g>
                );
              })}
              <circle cx="250" cy="200" r="4" fill="#00e5ff" />
            </svg>
            <div className="flex gap-2 mt-3">
              <button type="button" className={`font-label font-semibold text-xs px-3.5 py-1.5 rounded-2xl border transition-all ${heatmapView === 'batting' ? 'bg-accent-cyan text-black border-accent-cyan' : 'bg-white/5 border-white/10 text-muted'}`} onClick={() => setHeatmapView('batting')}>Batting View</button>
              <button type="button" className={`font-label font-semibold text-xs px-3.5 py-1.5 rounded-2xl border transition-all ${heatmapView === 'bowling' ? 'bg-accent-cyan text-black border-accent-cyan' : 'bg-white/5 border-white/10 text-muted'}`} onClick={() => setHeatmapView('bowling')}>Bowling View</button>
            </div>
          </div>
        </div>

        {/* WIN PROBABILITY */}
        <div className="glass-panel p-6">
          <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-4">📈 Win Probability</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={matchState.winProbability} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTeamA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3} /><stop offset="95%" stopColor="#00e5ff" stopOpacity={0} /></linearGradient>
                  <linearGradient id="colorTeamB" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ffd000" stopOpacity={0.3} /><stop offset="95%" stopColor="#ffd000" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="over" stroke="#8892a4" />
                <YAxis domain={[0, 100]} stroke="#8892a4" />
                <RTooltip content={tooltipContent} />
                <Area type="monotone" dataKey="teamA" stroke="#00e5ff" strokeWidth={2} fill="url(#colorTeamA)" animationDuration={2000} />
                <Area type="monotone" dataKey="teamB" stroke="#ffd000" strokeWidth={2} fill="url(#colorTeamB)" animationDuration={2000} />
                <ReferenceLine x={matchState.overs} stroke="#ff1744" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'NOW', fill: '#ff1744', fontSize: 11, fontFamily: 'Orbitron' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MOOD + INSIGHTS */}
        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
          <div className={`glass-panel min-h-[260px] flex flex-col items-center justify-center text-center transition-all duration-1000 ${derivedMood.cssClass}`}>
            <div className="text-[80px] leading-none mb-3">{derivedMood.emoji}</div>
            <div className="font-display font-bold text-[32px] text-white mb-2 tracking-wide">{derivedMood.label}</div>
            <div className="font-body text-sm text-muted">{derivedMood.reason}</div>
          </div>

          <div className="glass-panel flex flex-col justify-center gap-3 min-h-[260px] p-6">
            <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-1">🤖 AI Insights</h3>
            {visibleInsight && (
              <div key={insightIndex} className="px-4 py-3.5 border-l-4 border-accent-cyan bg-white/5 rounded-r-xl animate-insight-slide-in">
                <div className="flex items-center gap-2 mb-1.5 text-accent-cyan">
                  {visibleInsight.icon === 'target' && <Target size={16} />}
                  {visibleInsight.icon === 'trending' && <TrendingUp size={16} />}
                  {visibleInsight.icon === 'alert' && <AlertTriangle size={16} />}
                  <span className="font-label font-semibold text-[11px] text-accent-gold uppercase tracking-[0.5px]">{visibleInsight.tag}</span>
                </div>
                <div className="font-body font-medium text-[15px] text-gray-200 leading-snug">{visibleInsight.text}</div>
                <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-gold transition-all duration-1000" style={{ width: `${visibleInsight.confidence}%` }} />
                </div>
              </div>
            )}
            <div className="flex gap-1.5 justify-center mt-1">
              {activeInsights.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === insightIndex % activeInsights.length ? 'bg-accent-cyan' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* OVER IMPACT */}
        <div>
          <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-4 pl-1">🃏 Over Impact</h3>
          <div className="flex gap-3.5 overflow-x-auto pb-2.5 no-scrollbar">
            {matchState.allOvers.map((ov, i) => {
              const badge = getOverBadge(ov);
              const isCurrent = i === matchState.allOvers.length - 1;
              return (
                <div key={i} className={`min-w-[160px] h-[200px] glass-panel p-4 flex flex-col items-center justify-between relative flex-shrink-0 ${isCurrent ? 'border-accent-cyan animate-glow-pulse-cyan' : ''}`}>
                  {badge && <span className={`absolute top-2 right-2 text-[10px] font-display font-semibold px-2 py-0.5 rounded-lg ${badge.cls}`}>{badge.label}</span>}
                  <div className="font-display font-semibold text-xs text-muted tracking-[1px] uppercase">OVER {ov.over}</div>
                  <div className="font-display font-black text-5xl text-white leading-none">{ov.runs}</div>
                  <div className="font-label font-semibold text-[13px] text-muted text-center">
                    {ov.wickets > 0 ? `${ov.wickets}W` : 'No wickets'}
                    {ov.balls.includes('6') ? ' • 🔥' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PLAYER AURA */}
        <div>
          <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-4">✨ Player Aura</h3>
          <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
            {matchState.players.map((player, i) => (
              <div
                key={i}
                className="glass-panel flex flex-col items-center p-6 text-center"
              >
                <div className="relative w-[72px] h-[72px] mb-3.5">
                  <div className={`absolute inset-0 rounded-full border-[3px] ${player.aura === 'hot-streak' ? 'border-transparent bg-[linear-gradient(rgba(255,255,255,0.04),rgba(255,255,255,0.04))_padding-box,conic-gradient(#ffd000,#ff1744,#ffd000)_border-box] animate-aura-rotate' : player.aura === 'under-pressure' ? 'border-accent-red animate-glow-pulse-red' : player.aura === 'clutch' ? 'border-accent-green animate-glow-pulse-green' : 'border-[#444]'}`} />
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="w-16 h-16 rounded-full object-cover absolute top-1 left-1" />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-lg text-white absolute top-1 left-1" style={{ background: player.color }}>
                      {player.initials}
                    </div>
                  )}
                </div>
                <div className="font-label font-bold text-lg text-white mb-1">{player.name}</div>
                <div className="font-label font-semibold text-[11px] text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-0.5 rounded-xl uppercase tracking-[0.5px] mb-2.5">{player.role}</div>
                <div className="flex gap-3.5 font-label font-semibold text-[13px] text-muted mb-2">
                  {player.role === 'BATTER' ? (
                    <><span><span className="text-white">{player.runs}</span> R</span> | <span><span className="text-white">{player.balls}</span> B</span> | <span><span className="text-white">{player.sr}</span> SR</span></>
                  ) : (
                    <><span><span className="text-white">{player.overs}</span> Ov</span> | <span><span className="text-white">{player.runsConceded}</span> R</span> | <span><span className="text-white">{player.wkts}</span> W</span></>
                  )}
                </div>
                <div className={`font-display font-semibold text-[11px] tracking-[0.5px] ${player.aura === 'hot-streak' ? 'text-accent-gold' : player.aura === 'under-pressure' ? 'text-accent-red' : player.aura === 'clutch' ? 'text-accent-green' : 'text-muted'}`}>
                  {player.aura === 'hot-streak' ? '🔥 HOT STREAK' : player.aura === 'under-pressure' ? '😰 UNDER PRESSURE' : player.aura === 'clutch' ? '💎 CLUTCH' : '— NORMAL'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MATCH DNA */}
        <div className="glass-panel p-6 flex flex-col items-center">
          <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-4 self-start">🧬 Match DNA</h3>
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="axis" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={matchState.teams.a.short} dataKey="teamA" stroke="#00e5ff" fill="#00e5ff" fillOpacity={0.25} strokeWidth={2} animationDuration={1800} dot={{ r: 4, fill: '#00e5ff' }} />
                <Radar name={matchState.teams.b.short} dataKey="teamB" stroke="#ffd000" fill="#ffd000" fillOpacity={0.25} strokeWidth={2} animationDuration={1800} dot={{ r: 4, fill: '#ffd000' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TIMELINE */}
        <div className="glass-panel p-6">
          <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-5">⏳ Match Timeline</h3>
          <div className="overflow-x-auto py-5 no-scrollbar" ref={timelineRef} style={{ scrollBehavior: 'smooth' }}>
            <div className="flex items-center min-w-max relative">
              {matchState.events.map((evt, i) => {
                const isSix = evt.type === 'six';
                const isWicket = evt.type === 'wicket';
                const isMilestone = evt.type === 'milestone';
                const isBoundary = evt.type === 'boundary';
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <div className="w-10 h-0.5 bg-white/10 shrink-0" />}
                    <div className="flex flex-col items-center relative cursor-pointer" onMouseEnter={() => setHoveredTimeline(i)} onMouseLeave={() => setHoveredTimeline(null)}>
                      <div className={`rounded-full flex items-center justify-center relative z-10 transition-transform duration-200 hover:scale-[1.3] ${isSix ? 'bg-accent-gold/25 border-2 border-accent-gold w-10 h-10 shadow-glow-gold text-lg' : isWicket ? 'bg-accent-red/25 border-2 border-accent-red w-10 h-10 shadow-glow-red text-lg' : isMilestone ? 'bg-accent-cyan/25 border-2 border-accent-cyan w-10 h-10 shadow-glow-cyan text-lg' : isBoundary ? 'bg-accent-green/20 border-2 border-accent-green w-7 h-7 text-sm' : 'bg-white/5 border border-white/15 w-5 h-5 text-[8px]'}`}>
                        {isSix ? '💥' : isWicket ? '☠️' : isMilestone ? '🏆' : isBoundary ? '🟢' : '📊'}
                      </div>
                      {hoveredTimeline === i && (
                        <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 bg-[#0a1628]/95 border border-white/10 rounded-xl px-4 py-2.5 font-body text-xs text-white whitespace-nowrap z-[200]">
                          <div className="font-display text-[10px] text-accent-cyan mb-1">Over {evt.over}.{evt.ball}</div>
                          <div>{evt.desc}</div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
