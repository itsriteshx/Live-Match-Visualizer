import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, ReferenceLine
} from 'recharts';
import {
  Zap, Target, TrendingUp, AlertTriangle, Users, Activity,
  CircleDot
} from 'lucide-react';

/* ═══════════════════════════════════════════
   CONSTANTS & CONFIG
   ═══════════════════════════════════════════ */
const API_KEY = "YOUR_API_KEY_HERE";
const BASE = "https://api.cricapi.com/v1";

const SHOT_TYPES = ['Drive', 'Cut', 'Pull', 'Sweep', 'Flick', 'Loft', 'Edge', 'Glance', 'Hook', 'Scoop'];
const ZONES = ['Cover', 'Mid-on', 'Mid-off', 'Fine Leg', 'Square Leg', 'Third Man', 'Long-on', 'Long-off'];

/* ═══════════════════════════════════════════
   MOCK DATA — CSK vs MI
   ═══════════════════════════════════════════ */
function createMockState() {
  const currentOverBalls = ['1', '4', '0', '6', '2'];
  const allOvers = [
    { over: 1, runs: 8, wickets: 0, balls: ['1', '0', '4', '1', '2', '0'] },
    { over: 2, runs: 12, wickets: 0, balls: ['4', '2', '0', '6', '0', '0'] },
    { over: 3, runs: 6, wickets: 1, balls: ['0', '1', 'W', '0', '4', '1'] },
    { over: 4, runs: 14, wickets: 0, balls: ['4', '2', '1', '6', '0', '1'] },
    { over: 5, runs: 9, wickets: 0, balls: ['1', '0', '4', '1', '2', '1'] },
    { over: 6, runs: 11, wickets: 1, balls: ['6', '0', '0', 'W', '4', '1'] },
    { over: 7, runs: 5, wickets: 0, balls: ['0', '1', '0', '1', '2', '1'] },
    { over: 8, runs: 18, wickets: 0, balls: ['4', '6', '2', '4', '1', '1'] },
    { over: 9, runs: 7, wickets: 0, balls: ['1', '0', '2', '1', '0', '3'] },
    { over: 10, runs: 15, wickets: 1, balls: ['6', '4', '0', 'W', '4', '1'] },
    { over: 11, runs: 4, wickets: 0, balls: ['0', '1', '0', '1', '1', '1'] },
    { over: 12, runs: 10, wickets: 0, balls: ['4', '0', '2', '1', '2', '1'] },
    { over: 13, runs: 6, wickets: 0, balls: ['1', '0', '0', '1', '4', '0'] },
    { over: 14, runs: 9, wickets: 0, balls: ['1', '4', '0', '6', '2'] },
  ];

  const events = [];
  let cumulativeScore = 0;
  allOvers.forEach(ov => {
    ov.balls.forEach((b, bi) => {
      if (b === '6') events.push({ type: 'six', over: ov.over, ball: bi + 1, desc: `SIX over ${ZONES[Math.floor(Math.random() * 8)]}!` });
      else if (b === '4') events.push({ type: 'boundary', over: ov.over, ball: bi + 1, desc: `FOUR through ${ZONES[Math.floor(Math.random() * 8)]}` });
      else if (b === 'W') events.push({ type: 'wicket', over: ov.over, ball: bi + 1, desc: 'Bowled! Stumps shattered' });
    });
    cumulativeScore += ov.runs;
    events.push({ type: 'over-end', over: ov.over, ball: 6, desc: `End of over ${ov.over}: ${cumulativeScore} runs` });
    if (cumulativeScore >= 50 && cumulativeScore - ov.runs < 50) events.push({ type: 'milestone', over: ov.over, ball: 6, desc: 'TEAM 50 UP!' });
    if (cumulativeScore >= 100 && cumulativeScore - ov.runs < 100) events.push({ type: 'milestone', over: ov.over, ball: 6, desc: 'TEAM 100 UP!' });
  });

  const wagonWheelShots = [];
  allOvers.forEach(ov => {
    ov.balls.forEach(b => {
      const runs = b === 'W' ? 0 : b === 'WD' || b === 'NB' ? 1 : parseInt(b) || 0;
      if (runs > 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist = runs === 6 ? 0.9 + Math.random() * 0.1 : runs === 4 ? 0.7 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3;
        wagonWheelShots.push({ runs, angle, distance: dist, zone: ZONES[Math.floor(Math.random() * 8)], shot: SHOT_TYPES[Math.floor(Math.random() * 10)] });
      }
    });
  });

  const zoneRuns = {};
  ZONES.forEach(z => { zoneRuns[z] = Math.floor(Math.random() * 40) + 2; });

  const winProb = [];
  let pA = 50;
  for (let i = 1; i <= 20; i++) {
    if (i <= 14) {
      pA += (Math.random() - 0.45) * 8;
      pA = Math.max(15, Math.min(85, pA));
    } else {
      pA = 50 + (Math.random() - 0.5) * 10;
    }
    winProb.push({ over: i, teamA: Math.round(pA), teamB: Math.round(100 - pA) });
  }

  return {
    teams: { a: { name: 'Chennai Super Kings', short: 'CSK', color: '#ffd000' }, b: { name: 'Mumbai Indians', short: 'MI', color: '#004ba0' } },
    battingTeam: 'a',
    score: 134,
    wickets: 3,
    overs: 14,
    balls: 5,
    target: 186,
    currentOver: currentOverBalls,
    allOvers,
    players: [
      { name: 'Ruturaj Gaikwad', role: 'BATTER', runs: 67, balls: 42, sr: 159.5, aura: 'hot-streak', form: ['good', 'good', 'poor', 'good', 'good'], initials: 'RG', color: '#1a7a3a' },
      { name: 'Shivam Dube', role: 'BATTER', runs: 34, balls: 28, sr: 121.4, aura: 'clutch', form: ['good', 'na', 'good', 'poor', 'good'], initials: 'SD', color: '#8b4513' },
      { name: 'Jasprit Bumrah', role: 'BOWLER', overs: 4, runsConceded: 22, wkts: 2, aura: 'hot-streak', form: ['good', 'good', 'good', 'good', 'poor'], initials: 'JB', color: '#004ba0' },
      { name: 'Ravindra Jadeja', role: 'BOWLER', overs: 3, runsConceded: 18, wkts: 1, aura: 'under-pressure', form: ['poor', 'good', 'na', 'poor', 'good'], initials: 'RJ', color: '#1a7a3a' },
    ],
    partnership: { runs: 42, balls: 30 },
    lastFiveOversRuns: 44,
    fours: 10,
    sixes: 5,
    dots: 32,
    totalBalls: 89,
    wagonWheelShots,
    zoneRuns,
    winProbability: winProb,
    events,
    matchPhase: 'MIDDLE',
    matchDNA: {
      a: [{ axis: 'Aggression', val: 78 }, { axis: 'Risk Taking', val: 65 }, { axis: 'Consistency', val: 72 }, { axis: 'Pressure Handling', val: 58 }, { axis: 'Powerplay Impact', val: 82 }],
      b: [{ axis: 'Aggression', val: 60 }, { axis: 'Risk Taking', val: 55 }, { axis: 'Consistency', val: 80 }, { axis: 'Pressure Handling', val: 75 }, { axis: 'Powerplay Impact', val: 65 }],
    },
    simulating: false,
  };
}

/* ═══════════════════════════════════════════
   HELPER HOOKS
   ═══════════════════════════════════════════ */
function useInterval(callback, delay) {
  const savedCallback = useRef();
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/* ═══════════════════════════════════════════
   BALL CLASS LOGIC (Tailwind)
   ═══════════════════════════════════════════ */
function getBallClass(ball) {
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

/* ═══════════════════════════════════════════
   MAIN APP COMPONENT
   ═══════════════════════════════════════════ */
export default function App() {
  const [matchState, setMatchState] = useState(createMockState);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [viewportFlash, setViewportFlash] = useState(null);
  const [screenShake, setScreenShake] = useState(false);
  const [particles, setParticles] = useState([]);
  const [wagonFilter, setWagonFilter] = useState('All');
  const [heatmapView, setHeatmapView] = useState('batting');
  const [insightIndex, setInsightIndex] = useState(0);
  const [hoveredTimeline, setHoveredTimeline] = useState(null);
  const [apiError, setApiError] = useState(false);
  const [loading, setLoading] = useState(false);
  const timelineRef = useRef(null);

  useInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000)), 1000);
  useInterval(() => setInsightIndex(i => (i + 1) % 3), 8000);
  useInterval(() => { if (API_KEY !== "YOUR_API_KEY_HERE") fetchLiveData(); }, 30000);
  useInterval(() => { if (matchState.simulating) simulateBall(); }, matchState.simulating ? 3000 : null);

  useEffect(() => {
    if (timelineRef.current) timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
  }, [matchState.events.length]);

  async function fetchLiveData() {
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/currentMatches?apikey=${API_KEY}&offset=0`);
      const data = await res.json();
      if (data.status === 'success' && data.data && data.data.length > 0) {
        const liveMatch = data.data.find(m => m.matchStarted && !m.matchEnded) || data.data[0];
        if (liveMatch && liveMatch.id) {
          const matchRes = await fetch(`${BASE}/match_scorecard?apikey=${API_KEY}&id=${liveMatch.id}`);
          const matchData = await matchRes.json();
          if (matchData.status === 'success' && matchData.data) {
            const md = matchData.data;
            setMatchState(prev => ({
              ...prev,
              teams: {
                a: { name: md.teamInfo?.[0]?.name || prev.teams.a.name, short: md.teamInfo?.[0]?.shortname || prev.teams.a.short, color: prev.teams.a.color },
                b: { name: md.teamInfo?.[1]?.name || prev.teams.b.name, short: md.teamInfo?.[1]?.shortname || prev.teams.b.short, color: prev.teams.b.color },
              },
              score: md.score?.[0]?.r || prev.score,
              wickets: md.score?.[0]?.w || prev.wickets,
              overs: Math.floor(md.score?.[0]?.o || prev.overs),
              balls: Math.round(((md.score?.[0]?.o || prev.overs) % 1) * 10),
            }));
          }
        }
        setLastUpdated(Date.now());
        setApiError(false);
      }
    } catch (e) {
      console.error('API Error:', e);
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }

  const crr = useMemo(() => {
    const totalOvers = matchState.overs + matchState.balls / 6;
    return totalOvers > 0 ? (matchState.score / totalOvers).toFixed(2) : '0.00';
  }, [matchState.score, matchState.overs, matchState.balls]);

  const rrr = useMemo(() => {
    const totalOvers = matchState.overs + matchState.balls / 6;
    const remaining = 20 - totalOvers;
    const needed = matchState.target - matchState.score;
    return remaining > 0 ? (needed / remaining).toFixed(2) : '0.00';
  }, [matchState.score, matchState.target, matchState.overs, matchState.balls]);

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

    const deathEconomy = matchState.allOvers.filter(o => o.over > 15).reduce((s, o) => s + o.runs, 0) / Math.max(1, matchState.allOvers.filter(o => o.over > 15).length);
    if (matchState.allOvers.some(o => o.over > 15)) {
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

  const dotBallPct = useMemo(() => {
    return matchState.totalBalls > 0 ? Math.round((matchState.dots / matchState.totalBalls) * 100) : 0;
  }, [matchState.dots, matchState.totalBalls]);

  function simulateBall() {
    setMatchState(prev => {
      if (prev.wickets >= 10) return { ...prev, simulating: false };

      const rand = Math.random();
      let ball;
      if (rand < 0.38) ball = '0';
      else if (rand < 0.62) ball = '1';
      else if (rand < 0.75) ball = '2';
      else if (rand < 0.79) ball = '3';
      else if (rand < 0.89) ball = '4';
      else if (rand < 0.94) ball = '6';
      else if (rand < 0.94 + 0.04) ball = 'WD';
      else ball = prev.wickets < 10 ? 'W' : '0';

      const runs = ball === 'W' ? 0 : ball === 'WD' || ball === 'NB' ? 1 : parseInt(ball);
      const isWicket = ball === 'W';
      const isSix = ball === '6';
      const isFour = ball === '4';
      const isDot = ball === '0';
      const isExtra = ball === 'WD' || ball === 'NB';

      let newCurrentOver = [...prev.currentOver];
      let newAllOvers = [...prev.allOvers];
      let newBalls = prev.balls + (isExtra ? 0 : 1);
      let newOvers = prev.overs;
      let newEvents = [...prev.events];

      newCurrentOver.push(ball);

      if (isSix) newEvents.push({ type: 'six', over: newOvers + 1, ball: newBalls, desc: `SIX over ${ZONES[Math.floor(Math.random() * 8)]}!` });
      if (isFour) newEvents.push({ type: 'boundary', over: newOvers + 1, ball: newBalls, desc: `FOUR through ${ZONES[Math.floor(Math.random() * 8)]}` });
      if (isWicket) newEvents.push({ type: 'wicket', over: newOvers + 1, ball: newBalls, desc: 'OUT! Brilliant delivery' });

      if (newBalls >= 6 && !isExtra) {
        const overRuns = newCurrentOver.reduce((s, b) => {
          if (b === 'W') return s;
          if (b === 'WD' || b === 'NB') return s + 1;
          return s + (parseInt(b) || 0);
        }, 0);
        const overWickets = newCurrentOver.filter(b => b === 'W').length;
        newAllOvers.push({ over: newOvers + 1, runs: overRuns, wickets: overWickets, balls: [...newCurrentOver] });
        newEvents.push({ type: 'over-end', over: newOvers + 1, ball: 6, desc: `End of over ${newOvers + 1}` });
        newCurrentOver = [];
        newOvers += 1;
        newBalls = 0;
      }

      const newScore = prev.score + runs;
      const newWickets = prev.wickets + (isWicket ? 1 : 0);

      const newShots = [...prev.wagonWheelShots];
      if (runs > 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist = runs === 6 ? 0.9 + Math.random() * 0.1 : runs === 4 ? 0.7 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3;
        newShots.push({ runs, angle, distance: dist, zone: ZONES[Math.floor(Math.random() * 8)], shot: SHOT_TYPES[Math.floor(Math.random() * 10)] });
      }

      const newZoneRuns = { ...prev.zoneRuns };
      if (runs > 0) {
        const zone = ZONES[Math.floor(Math.random() * 8)];
        newZoneRuns[zone] = (newZoneRuns[zone] || 0) + runs;
      }

      const newWinProb = [...prev.winProbability];
      const totalOversFloat = newOvers + newBalls / 6;
      const overIdx = Math.min(19, Math.floor(totalOversFloat));
      if (newWinProb[overIdx]) {
        const shift = isSix ? 3 : isFour ? 2 : isWicket ? -5 : runs > 0 ? 1 : -0.5;
        const newPa = Math.max(5, Math.min(95, newWinProb[overIdx].teamA + shift));
        newWinProb[overIdx] = { ...newWinProb[overIdx], teamA: Math.round(newPa), teamB: Math.round(100 - newPa) };
      }

      const newPartnership = isWicket ? { runs: 0, balls: 0 } : { runs: prev.partnership.runs + runs, balls: prev.partnership.balls + 1 };
      const last5Runs = newAllOvers.slice(-5).reduce((s, o) => s + o.runs, 0) + newCurrentOver.reduce((s, b) => {
        if (b === 'W') return s;
        if (b === 'WD' || b === 'NB') return s + 1;
        return s + (parseInt(b) || 0);
      }, 0);

      if (newScore >= 50 && prev.score < 50) newEvents.push({ type: 'milestone', over: newOvers + 1, ball: newBalls, desc: 'TEAM 50 UP!' });
      if (newScore >= 100 && prev.score < 100) newEvents.push({ type: 'milestone', over: newOvers + 1, ball: newBalls, desc: 'CENTURY UP!' });

      return {
        ...prev,
        score: newScore,
        wickets: newWickets,
        overs: newOvers,
        balls: newBalls,
        currentOver: newCurrentOver,
        allOvers: newAllOvers,
        events: newEvents,
        wagonWheelShots: newShots,
        zoneRuns: newZoneRuns,
        winProbability: newWinProb,
        partnership: newPartnership,
        lastFiveOversRuns: last5Runs,
        fours: prev.fours + (isFour ? 1 : 0),
        sixes: prev.sixes + (isSix ? 1 : 0),
        dots: prev.dots + (isDot ? 1 : 0),
        totalBalls: prev.totalBalls + 1,
      };
    });

    setMatchState(prev => {
      const lastBall = prev.currentOver.length > 0 ? prev.currentOver[prev.currentOver.length - 1] : (prev.allOvers.length > 0 ? prev.allOvers[prev.allOvers.length - 1].balls.slice(-1)[0] : null);
      if (lastBall === 'W') triggerWicketEffect();
      else if (lastBall === '6') triggerSixEffect();
      return prev;
    });
    setLastUpdated(Date.now());
  }

  function triggerWicketEffect() {
    setViewportFlash('bg-accent-red/30');
    setScreenShake(true);
    addToast('WICKET! 🏏', 'bg-accent-red/90 text-white shadow-glow-red');
    setTimeout(() => { setViewportFlash(null); setScreenShake(false); }, 400);
  }

  function triggerSixEffect() {
    addToast('SIX! 💥', 'bg-accent-gold/90 text-black shadow-glow-gold');
    const newParticles = [];
    for (let i = 0; i < 15; i++) {
      const angle = (Math.PI * 2 * i) / 15 + (Math.random() - 0.5) * 0.5;
      const dist = 80 + Math.random() * 120;
      newParticles.push({ id: Date.now() + i, px: Math.cos(angle) * dist, py: Math.sin(angle) * dist });
    }
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1100);
  }

  function addToast(text, className) {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, className }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2100);
  }

  function toggleSimulation() {
    setMatchState(prev => ({ ...prev, simulating: !prev.simulating }));
  }

  const filteredShots = useMemo(() => {
    if (wagonFilter === 'All') return matchState.wagonWheelShots;
    if (wagonFilter === 'Boundaries') return matchState.wagonWheelShots.filter(s => s.runs >= 4);
    if (wagonFilter === 'Dots') return [];
    if (wagonFilter === 'Singles') return matchState.wagonWheelShots.filter(s => s.runs <= 1);
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

  const radarData = useMemo(() => {
    return matchState.matchDNA.a.map((item, i) => ({
      axis: item.axis,
      teamA: item.val,
      teamB: matchState.matchDNA.b[i].val,
    }));
  }, [matchState.matchDNA]);

  function CustomWinTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-secondary/95 border border-white/10 rounded-lg px-4 py-3 backdrop-blur-md shadow-glow-cyan">
        <p className="text-muted text-xs mb-1 font-label font-semibold">Over {label}</p>
        <p className="text-accent-cyan font-label font-semibold">{matchState.teams.a.short}: {payload[0]?.value}%</p>
        <p className="text-accent-gold font-label font-semibold">{matchState.teams.b.short}: {payload[1]?.value}%</p>
      </div>
    );
  }

  const oversFloat = matchState.overs + matchState.balls / 10;

  return (
    <>
      {viewportFlash && <div className={`fixed inset-0 pointer-events-none z-[8000] animate-vp-flash ${viewportFlash}`} />}

      {particles.length > 0 && (
        <div className="fixed top-1/2 left-1/2 pointer-events-none z-[8000]">
          {particles.map(p => (
            <div key={p.id} className="absolute w-2 h-2 rounded-full bg-accent-gold shadow-[0_0_6px_#ffd000] animate-particle-burst" style={{ '--px': `${p.px}px`, '--py': `${p.py}px` }} />
          ))}
        </div>
      )}

      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-7 py-3.5 rounded-xl font-display font-bold text-lg tracking-wider text-center backdrop-blur-md animate-toast-in-out ${t.className}`}>
            {t.text}
          </div>
        ))}
      </div>

      <div className={`max-w-7xl mx-auto p-6 pb-20 flex flex-col gap-8 relative ${screenShake ? 'animate-screen-shake' : ''}`}>

        {/* 1. HERO SCOREBOARD */}
        <div className="glass-panel min-h-[200px] flex max-sm:flex-col items-center justify-between px-10 py-7 relative overflow-hidden bg-gradient-to-br from-[#0a1628]/90 to-[#05080f]/95 animate-mesh-drift animation-delay-0">
          <div className="absolute top-4 right-5 flex items-center gap-2 font-display font-bold text-xs text-accent-red tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-red animate-live-pulse" />
            LIVE
          </div>
          <div className="absolute top-9 right-5 text-[11px] text-muted font-body">Last updated: {secondsAgo}s ago</div>

          <div className="flex items-center gap-4 flex-1 max-sm:order-2 max-sm:mt-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-sm text-white border-2 shadow-glow-cyan" style={{ borderColor: matchState.teams.a.color }}>
              {matchState.teams.a.short}
            </div>
            <div className="font-label font-bold text-[22px] text-white tracking-[0.5px]">{matchState.teams.a.name}</div>
          </div>

          <div className="text-center flex-[2] max-sm:order-1">
            <div className="font-display font-black text-7xl max-lg:text-5xl max-sm:text-[40px] text-accent-gold drop-shadow-[0_0_20px_rgba(255,208,0,0.4)] leading-none tracking-[2px] hover:scale-105 transition-transform duration-300">
              {matchState.score} / {matchState.wickets}
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
              Target: {matchState.target} | Need: {Math.max(0, matchState.target - matchState.score)}
            </div>
          </div>
        </div>

        {/* 2. BALL TRACKER */}
        <div className="glass-panel p-7 animation-delay-100 group">
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

        {/* 3. STATS ROW */}
        <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
          {[
            { icon: Users, val: matchState.partnership.runs, sub: `(${matchState.partnership.balls})`, label: 'Partnership', delay: '200ms' },
            { icon: Activity, val: matchState.lastFiveOversRuns, sub: '', label: 'Last 5 Overs Runs', delay: '300ms' },
            { icon: Zap, val: `${matchState.fours} / ${matchState.sixes}`, sub: ' (4s/6s)', label: 'Boundaries', delay: '400ms' },
            { icon: CircleDot, val: `${dotBallPct}%`, sub: '', label: 'Dot Ball %', delay: '500ms' }
          ].map((stat, i) => (
            <div key={i} className="glass-panel p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform" style={{ animationDelay: stat.delay }}>
              <div className="absolute bottom-0 left-5 right-5 h-[2px] bg-gradient-to-r from-accent-cyan to-transparent rounded-sm opacity-50 group-hover:opacity-100 transition-opacity" />
              <stat.icon size={20} className="text-accent-cyan mb-2.5 group-hover:scale-110 transition-transform origin-left" />
              <div className="font-display font-bold text-4xl text-white leading-[1.1]">
                {stat.val}<span className="text-base text-muted ml-1">{stat.sub}</span>
              </div>
              <div className="font-label font-semibold text-sm text-muted mt-1.5 uppercase tracking-[0.5px]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* 4 & 5. WAGON WHEEL + HEATMAP */}
        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
          <div className="glass-panel p-5 animation-delay-[600ms]">
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
                    strokeLinecap="round" className="hover:opacity-100 hover:stroke-[3px] transition-all cursor-crosshair">
                    <title>{shot.shot} | {shot.runs} runs | {shot.zone}</title>
                  </line>
                );
              })}
              <circle cx="250" cy="200" r="4" fill="#00e5ff" />
            </svg>
            <div className="flex gap-2 mt-3">
              {['All', 'Boundaries', 'Singles', 'Dots'].map(f => (
                <button key={f} className={`font-label font-semibold text-xs px-3.5 py-1.5 rounded-2xl border transition-all ${wagonFilter === f ? 'bg-accent-gold text-black border-accent-gold' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:text-white'}`} onClick={() => setWagonFilter(f)}>{f}</button>
              ))}
            </div>
          </div>

          <div className="glass-panel p-5 animation-delay-[700ms]">
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
                  <g key={zone} className="hover:opacity-100 transition-opacity cursor-pointer">
                    <path d={`M 250 200 L ${250 + Math.cos(angle) * 230} ${200 + Math.sin(angle) * 180} A 230 180 0 0 1 ${250 + Math.cos(nextAngle) * 230} ${200 + Math.sin(nextAngle) * 180} Z`} fill={color} opacity={opacity} stroke="rgba(255,255,255,0.1)" strokeWidth="1" className="transition-all duration-500">
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
              <button className={`font-label font-semibold text-xs px-3.5 py-1.5 rounded-2xl border transition-all ${heatmapView === 'batting' ? 'bg-accent-cyan text-black border-accent-cyan' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:text-white'}`} onClick={() => setHeatmapView('batting')}>Batting View</button>
              <button className={`font-label font-semibold text-xs px-3.5 py-1.5 rounded-2xl border transition-all ${heatmapView === 'bowling' ? 'bg-accent-cyan text-black border-accent-cyan' : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:text-white'}`} onClick={() => setHeatmapView('bowling')}>Bowling View</button>
            </div>
          </div>
        </div>

        {/* 6. WIN PREDICTOR */}
        <div className="glass-panel p-6 animation-delay-[800ms]">
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
                <RTooltip content={<CustomWinTooltip />} />
                <Area type="monotone" dataKey="teamA" stroke="#00e5ff" strokeWidth={2} fill="url(#colorTeamA)" animationDuration={2000} />
                <Area type="monotone" dataKey="teamB" stroke="#ffd000" strokeWidth={2} fill="url(#colorTeamB)" animationDuration={2000} />
                <ReferenceLine x={matchState.overs} stroke="#ff1744" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'NOW', fill: '#ff1744', fontSize: 11, fontFamily: 'Orbitron' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7. MOOD + INSIGHTS */}
        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
          <div className={`glass-panel min-h-[260px] flex flex-col items-center justify-center text-center transition-all duration-1000 ${derivedMood.cssClass} animation-delay-[900ms]`}>
            <div className="text-[80px] leading-none mb-3 hover:scale-125 transition-transform duration-500 cursor-default">{derivedMood.emoji}</div>
            <div className="font-display font-bold text-[32px] text-white mb-2 tracking-wide">{derivedMood.label}</div>
            <div className="font-body text-sm text-muted">{derivedMood.reason}</div>
          </div>

          <div className="glass-panel flex flex-col justify-center gap-3 min-h-[260px] p-6 animation-delay-[1000ms]">
            <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-1">🤖 AI Insights</h3>
            {activeInsights.map((insight, i) => (
              <div key={`${insightIndex}-${i}`} className="px-4 py-3.5 border-l-4 border-accent-cyan bg-white/5 rounded-r-xl animate-insight-slide-in group hover:bg-white/10 transition-colors" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="flex items-center gap-2 mb-1.5 text-accent-cyan group-hover:scale-[1.02] transition-transform origin-left">
                  {insight.icon === 'target' && <Target size={16} />}
                  {insight.icon === 'trending' && <TrendingUp size={16} />}
                  {insight.icon === 'alert' && <AlertTriangle size={16} />}
                  <span className="font-label font-semibold text-[11px] text-accent-gold uppercase tracking-[0.5px]">{insight.tag}</span>
                </div>
                <div className="font-body font-medium text-[15px] text-gray-200 leading-snug">{insight.text}</div>
                <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-gold transition-all duration-1000" style={{ width: `${insight.confidence}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 8. OVER IMPACT CARDS */}
        <div className="animation-delay-[1000ms]">
          <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-4 pl-1">🃏 Over Impact</h3>
          <div className="flex gap-3.5 overflow-x-auto pb-2.5 no-scrollbar">
            {matchState.allOvers.map((ov, i) => {
              const badge = getOverBadge(ov);
              const isCurrent = i === matchState.allOvers.length - 1;
              return (
                <div key={i} className={`min-w-[160px] h-[200px] glass-panel p-4 flex flex-col items-center justify-between relative cursor-pointer hover:scale-105 hover:shadow-glow-cyan transition-all flex-shrink-0 group ${isCurrent ? 'border-accent-cyan animate-glow-pulse-cyan' : ''}`}>
                  {badge && <span className={`absolute top-2 right-2 text-[10px] font-display font-semibold px-2 py-0.5 rounded-lg tracking-widest ${badge.cls} group-hover:brightness-125 transition-all`}>{badge.label}</span>}
                  <div className="font-display font-semibold text-xs text-muted tracking-[1px] uppercase group-hover:text-white transition-colors">OVER {ov.over}</div>
                  <div className="font-display font-black text-5xl text-white leading-none group-hover:scale-110 transition-transform">{ov.runs}</div>
                  <div className="font-label font-semibold text-[13px] text-muted text-center group-hover:text-accent-cyan transition-colors">
                    {ov.wickets > 0 ? `${ov.wickets}W` : 'No wickets'}
                    {ov.balls.includes('6') ? ' • 🔥' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 9. PLAYER AURA CARDS */}
        <div className="animation-delay-[1000ms]">
          <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-4">✨ Player Aura</h3>
          <div className="grid grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
            {matchState.players.map((player, i) => (
              <div key={i} className="glass-panel flex flex-col items-center p-6 text-center group hover:scale-[1.02] transition-transform">
                <div className="relative w-[72px] h-[72px] mb-3.5">
                  <div className={`absolute inset-0 rounded-full border-[3px] ${player.aura === 'hot-streak' ? 'border-transparent bg-[linear-gradient(rgba(255,255,255,0.04),rgba(255,255,255,0.04))_padding-box,conic-gradient(#ffd000,#ff1744,#ffd000)_border-box] animate-aura-rotate' : player.aura === 'under-pressure' ? 'border-accent-red animate-glow-pulse-red' : player.aura === 'clutch' ? 'border-accent-green animate-glow-pulse-green' : 'border-[#444]'}`} />
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-lg text-white absolute top-1 left-1" style={{ background: player.color }}>
                    {player.initials}
                  </div>
                </div>
                <div className="font-label font-bold text-lg text-white mb-1 group-hover:text-accent-cyan transition-colors">{player.name}</div>
                <div className="font-label font-semibold text-[11px] text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-0.5 rounded-xl uppercase tracking-[0.5px] mb-2.5">{player.role}</div>
                <div className="flex gap-3.5 font-label font-semibold text-[13px] text-muted mb-2">
                  {player.role === 'BATTER' ? (
                    <><span><span className="text-white">{player.runs}</span> R</span> | <span><span className="text-white">{player.balls}</span> B</span> | <span><span className="text-white">{player.sr}</span> SR</span></>
                  ) : (
                    <><span><span className="text-white">{player.overs}</span> Ov</span> | <span><span className="text-white">{player.runsConceded}</span> R</span> | <span><span className="text-white">{player.wkts}</span> W</span></>
                  )}
                </div>
                <div className="flex gap-1.5 mb-2">
                  {player.form.map((f, fi) => (
                    <div key={fi} className={`w-2 h-2 rounded-full ${f === 'good' ? 'bg-accent-green' : f === 'poor' ? 'bg-accent-red' : 'bg-[#444]'}`} />
                  ))}
                </div>
                <div className={`font-display font-semibold text-[11px] tracking-[0.5px] ${player.aura === 'hot-streak' ? 'text-accent-gold' : player.aura === 'under-pressure' ? 'text-accent-red' : player.aura === 'clutch' ? 'text-accent-green' : 'text-muted'}`}>
                  {player.aura === 'hot-streak' ? '🔥 HOT STREAK' : player.aura === 'under-pressure' ? '😰 UNDER PRESSURE' : player.aura === 'clutch' ? '💎 CLUTCH' : '— NORMAL'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 10. MATCH DNA RADAR */}
        <div className="glass-panel p-6 flex flex-col items-center animation-delay-[1000ms]">
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
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2 font-label font-semibold text-sm text-white"><div className="w-3 h-3 rounded-sm bg-accent-cyan" />{matchState.teams.a.name}</div>
            <div className="flex items-center gap-2 font-label font-semibold text-sm text-white"><div className="w-3 h-3 rounded-sm bg-accent-gold" />{matchState.teams.b.name}</div>
          </div>
        </div>

        {/* 11. TIMELINE */}
        <div className="glass-panel p-6 animation-delay-[1000ms]">
          <h3 className="font-display font-bold text-[13px] text-accent-cyan tracking-[1.5px] uppercase mb-5">⏳ Match Timeline</h3>
          <div className="overflow-x-auto py-5 no-scrollbar" ref={timelineRef} style={{ scrollBehavior: 'smooth' }}>
            <div className="flex items-center min-w-max relative">
              {matchState.events.map((evt, i) => {
                const isSix = evt.type === 'six';
                const isWicket = evt.type === 'wicket';
                const isMilestone = evt.type === 'milestone';
                const isBoundary = evt.type === 'boundary';
                const isOverEnd = evt.type === 'over-end';

                return (
                  <React.Fragment key={i}>
                    {i > 0 && <div className="w-10 h-0.5 bg-white/10 shrink-0" />}
                    <div className="flex flex-col items-center relative cursor-pointer group/node" onMouseEnter={() => setHoveredTimeline(i)} onMouseLeave={() => setHoveredTimeline(null)}>
                      <div className={`rounded-full flex items-center justify-center relative z-10 transition-transform duration-200 hover:scale-[1.3] ${isSix ? 'bg-accent-gold/25 border-2 border-accent-gold w-10 h-10 shadow-glow-gold text-lg' : isWicket ? 'bg-accent-red/25 border-2 border-accent-red w-10 h-10 shadow-glow-red text-lg' : isMilestone ? 'bg-accent-cyan/25 border-2 border-accent-cyan w-10 h-10 shadow-glow-cyan text-lg' : isBoundary ? 'bg-accent-green/20 border-2 border-accent-green w-7 h-7 text-sm' : 'bg-white/5 border border-white/15 w-5 h-5 text-[8px]'}`}>
                        {isSix ? '💥' : isWicket ? '☠️' : isMilestone ? '🏆' : isBoundary ? '🟢' : '📊'}
                      </div>
                      {hoveredTimeline === i && (
                        <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 bg-[#0a1628]/95 border border-white/10 rounded-xl px-4 py-2.5 font-body text-xs text-white whitespace-nowrap z-[200] shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#0a1628]/95" />
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

      <button className={`fixed bottom-6 right-6 z-[1000] px-7 py-3.5 rounded-full font-display font-bold text-sm tracking-[1px] cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 ${matchState.simulating ? 'bg-accent-red text-white shadow-glow-red hover:shadow-glow-red-lg' : 'bg-accent-gold text-black shadow-glow-gold hover:shadow-glow-gold-lg'}`} onClick={toggleSimulation}>
        ⚡ {matchState.simulating ? 'STOP' : 'SIMULATE'}
      </button>
    </>
  );
}
