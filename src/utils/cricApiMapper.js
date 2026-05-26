import { createEmptyMatchState } from '../data/emptyMatchState.js';

const TEAM_COLORS = ['#ffd000', '#004ba0', '#1a7a3a', '#8b0000', '#4a148c', '#006064'];

function parseOvers(o) {
  if (o == null) return { overs: 0, balls: 0 };
  const n = Number(o);
  const whole = Math.floor(n);
  const frac = n - whole;
  const balls = Math.round(frac * 10);
  return { overs: whole, balls: balls >= 6 ? 0 : balls };
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function inferAura(sr, wkts) {
  if (wkts >= 2) return 'hot-streak';
  if (sr >= 150) return 'hot-streak';
  if (sr > 0 && sr < 90) return 'under-pressure';
  if (sr >= 130) return 'clutch';
  return 'normal';
}

function seriesFromName(name = '') {
  const parts = name.split(',');
  if (parts.length >= 2) return parts.slice(1).join(',').trim();
  return name;
}

function getCurrentInning(scores = []) {
  if (!scores.length) return null;
  return scores[scores.length - 1];
}

function getTarget(scores) {
  if (scores.length < 2) return null;
  return (scores[0].r ?? 0) + 1;
}

function buildAllOversFromScores(scores = []) {
  return scores.map((s, i) => {
    const { overs } = parseOvers(s.o);
    return {
      over: overs || i + 1,
      runs: s.r ?? 0,
      wickets: s.w ?? 0,
      balls: [],
    };
  });
}

function buildEventsFromScorecard(scorecard = [], scores = []) {
  const events = [];
  scorecard.forEach((inning, ii) => {
    (inning.batting ?? []).forEach((b, bi) => {
      if (b.dismissal && b.dismissal !== 'not out') {
        events.push({
          type: 'wicket',
          over: ii + 1,
          ball: bi + 1,
          desc: b['dismissal-text'] || `${b.batsman?.name} ${b.dismissal}`,
        });
      }
      if ((b['6s'] ?? 0) > 0) {
        events.push({
          type: 'six',
          over: ii + 1,
          ball: bi + 1,
          desc: `${b.batsman?.name} — ${b['6s']} six(es)`,
        });
      }
      if ((b['4s'] ?? 0) > 0) {
        events.push({
          type: 'boundary',
          over: ii + 1,
          ball: bi + 1,
          desc: `${b.batsman?.name} — ${b['4s']} fours`,
        });
      }
    });
  });
  let total = 0;
  scores.forEach((s, i) => {
    total += s.r ?? 0;
    events.push({
      type: 'over-end',
      over: i + 1,
      ball: 6,
      desc: `Innings ${i + 1}: ${s.r}/${s.w} (${s.o} ov)`,
    });
    if (total >= 50 && total - (s.r ?? 0) < 50) {
      events.push({ type: 'milestone', over: i + 1, ball: 6, desc: 'TEAM 50 UP!' });
    }
    if (total >= 100 && total - (s.r ?? 0) < 100) {
      events.push({ type: 'milestone', over: i + 1, ball: 6, desc: 'CENTURY UP!' });
    }
  });
  return events;
}

function buildWinProbability(scores = []) {
  if (!scores.length) return [];
  const totalOvers = 20;
  const prob = [];
  let teamA = 50;
  scores.forEach((s, idx) => {
    const endOver = Math.min(totalOvers, Math.ceil(parseOvers(s.o).overs + parseOvers(s.o).balls / 6) || (idx + 1) * 10);
    for (let o = prob.length + 1; o <= endOver; o++) {
      if (idx === 0) teamA = 45;
      else teamA = s.r > (scores[0]?.r ?? 0) ? 65 : 35;
      prob.push({ over: o, teamA, teamB: 100 - teamA });
    }
  });
  while (prob.length < totalOvers) {
    const last = prob[prob.length - 1]?.teamA ?? 50;
    prob.push({ over: prob.length + 1, teamA: last, teamB: 100 - last });
  }
  return prob.slice(0, totalOvers);
}

function sumBattingStats(scorecard = []) {
  let fours = 0;
  let sixes = 0;
  let dots = 0;
  let totalBalls = 0;
  scorecard.forEach((inn) => {
    (inn.batting ?? []).forEach((b) => {
      fours += b['4s'] ?? 0;
      sixes += b['6s'] ?? 0;
      totalBalls += b.b ?? 0;
      if (b.r === 0 && b.b > 0) dots += 1;
    });
  });
  return { fours, sixes, dots, totalBalls };
}

export function extractCricApiMatches(data) {
  const list = data?.data ?? [];
  return list.map((m, i) => {
    const live = m.matchStarted && !m.matchEnded;
    const team1 = m.teams?.[0] || m.teamInfo?.[0]?.name;
    const team2 = m.teams?.[1] || m.teamInfo?.[1]?.name;
    return {
      matchId: String(m.id),
      label: `${team1 || 'T1'} vs ${team2 || 'T2'}${m.venue ? ` — ${m.venue}` : ''}${live ? ' (LIVE)' : ''}`,
      team1,
      team2,
      venue: m.venue,
      seriesName: seriesFromName(m.name),
      status: m.status,
      isLive: live,
      raw: m,
      sortOrder: live ? 0 : m.matchStarted ? 1 : 2,
      index: i,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.index - b.index);
}

export function mapCricApiFromListMatch(m) {
  const empty = createEmptyMatchState();
  const teamInfo = m.teamInfo ?? [];
  const scores = m.score ?? [];
  const current = getCurrentInning(scores);
  const { overs, balls } = parseOvers(current?.o);
  const target = getTarget(scores);
  const stats = sumBattingStats(m.scorecard ?? []);

  const battingTeamIdx = scores.length >= 2 ? 1 : 0;
  const teamA = teamInfo[battingTeamIdx] || teamInfo[0];
  const teamB = teamInfo[battingTeamIdx === 0 ? 1 : 0] || teamInfo[1];

  const totalOvers = overs + balls / 6;
  const crr = totalOvers > 0 && current ? (current.r / totalOvers).toFixed(2) : null;
  const needed = target != null && current ? target - current.r : null;
  const remaining = target != null ? Math.max(0, 20 - totalOvers) : 0;
  const rrr = needed != null && remaining > 0 ? (needed / remaining).toFixed(2) : null;

  return {
    ...empty,
    matchId: m.id,
    matchName: m.name,
    matchNumber: m.status,
    venue: m.venue || '',
    seriesName: seriesFromName(m.name),
    teams: {
      a: {
        name: teamA?.name || m.teams?.[battingTeamIdx] || '—',
        short: teamA?.shortname || initials(teamA?.name || 'A'),
        color: TEAM_COLORS[0],
        img: teamA?.img,
      },
      b: {
        name: teamB?.name || m.teams?.[1 - battingTeamIdx] || '—',
        short: teamB?.shortname || initials(teamB?.name || 'B'),
        color: TEAM_COLORS[1],
        img: teamB?.img,
      },
    },
    score: current?.r ?? 0,
    wickets: current?.w ?? 0,
    overs,
    balls,
    target,
    crr: crr != null ? parseFloat(crr) : null,
    rrr: rrr != null ? parseFloat(rrr) : null,
    allOvers: buildAllOversFromScores(scores),
    events: buildEventsFromScorecard(m.scorecard ?? [], scores),
    winProbability: buildWinProbability(scores),
    fours: stats.fours,
    sixes: stats.sixes,
    dots: stats.dots,
    totalBalls: stats.totalBalls,
    matchEnded: m.matchEnded,
    matchStarted: m.matchStarted,
    statusText: m.status,
    dataSource: 'cricapi',
  };
}

export function mapCricApiScorecard(data, listMatch) {
  const md = data?.data ?? {};
  const base = listMatch?.raw ? mapCricApiFromListMatch(listMatch.raw) : createEmptyMatchState();

  const teamInfo = md.teamInfo ?? [];
  const scores = md.score ?? [];
  const current = getCurrentInning(scores);
  const { overs, balls } = parseOvers(current?.o);
  const target = getTarget(scores);

  const scorecard = md.scorecard ?? [];
  const currentInning = scorecard[scorecard.length - 1] || scorecard[0] || {};
  const battingCards = currentInning.batting ?? [];
  const bowlingCards = currentInning.bowling ?? [];

  const notOutBatters = battingCards.filter((b) => b.dismissal === 'not out');
  const battersToShow = notOutBatters.length >= 2
    ? notOutBatters.slice(0, 2)
    : battingCards.slice(-2);

  const players = [];

  battersToShow.forEach((b, i) => {
    const name = b.batsman?.name || `Batter ${i + 1}`;
    const runs = b.r ?? 0;
    const ballsFaced = b.b ?? 0;
    const sr = b.sr ?? (ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(1) : 0);
    players.push({
      name,
      role: 'BATTER',
      runs,
      balls: ballsFaced,
      sr: typeof sr === 'number' ? sr : parseFloat(sr),
      aura: inferAura(parseFloat(sr), 0),
      form: ['good', 'na', 'good', 'poor', 'good'],
      initials: initials(name),
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      photoUrl: null,
    });
  });

  bowlingCards.slice(0, 2).forEach((b, i) => {
    const name = b.bowler?.name || `Bowler ${i + 1}`;
    const ov = parseOvers(b.o);
    players.push({
      name,
      role: 'BOWLER',
      overs: ov.overs + ov.balls / 6,
      runsConceded: b.r ?? 0,
      wkts: b.w ?? 0,
      aura: inferAura(0, b.w ?? 0),
      form: ['good', 'good', 'na', 'poor', 'good'],
      initials: initials(name),
      color: TEAM_COLORS[(i + 2) % TEAM_COLORS.length],
      photoUrl: null,
    });
  });

  const battingIdx = scores.length >= 2 ? 1 : 0;
  const teamA = teamInfo[battingIdx] || teamInfo[0];
  const teamB = teamInfo[battingIdx === 0 ? 1 : 0] || teamInfo[1];

  const partnershipRuns = battersToShow.reduce((s, b) => s + (b.r ?? 0), 0);
  const partnershipBalls = battersToShow.reduce((s, b) => s + (b.b ?? 0), 0);
  const lastWicket = battingCards.filter((b) => b.dismissal && b.dismissal !== 'not out').pop();
  const stats = sumBattingStats(scorecard);

  const totalOvers = overs + balls / 6;
  const crr = totalOvers > 0 && current ? (current.r / totalOvers).toFixed(2) : null;
  const needed = target != null && current ? target - current.r : null;
  const remaining = target != null ? Math.max(0, 20 - totalOvers) : 0;
  const rrr = needed != null && remaining > 0 ? (needed / remaining).toFixed(2) : null;

  const allOvers = buildAllOversFromScores(scores);
  const lastFiveOversRuns = allOvers.slice(-5).reduce((s, o) => s + o.runs, 0);

  return {
    ...base,
    matchId: md.id,
    matchName: md.name || base.matchName,
    matchNumber: md.status,
    venue: md.venue || base.venue,
    seriesName: seriesFromName(md.name) || base.seriesName,
    teams: {
      a: {
        name: teamA?.name || '—',
        short: teamA?.shortname || initials(teamA?.name || 'A'),
        color: TEAM_COLORS[0],
        img: teamA?.img,
      },
      b: {
        name: teamB?.name || '—',
        short: teamB?.shortname || initials(teamB?.name || 'B'),
        color: TEAM_COLORS[1],
        img: teamB?.img,
      },
    },
    score: current?.r ?? 0,
    wickets: current?.w ?? 0,
    overs,
    balls,
    target,
    crr: crr != null ? parseFloat(crr) : null,
    rrr: rrr != null ? parseFloat(rrr) : null,
    partnership: { runs: partnershipRuns, balls: partnershipBalls },
    lastWicket: lastWicket
      ? `${lastWicket.batsman?.name} ${lastWicket['dismissal-text'] || lastWicket.dismissal}`
      : null,
    players,
    allOvers,
    lastFiveOversRuns,
    events: buildEventsFromScorecard(scorecard, scores),
    winProbability: buildWinProbability(scores),
    fours: stats.fours,
    sixes: stats.sixes,
    dots: stats.dots,
    totalBalls: stats.totalBalls,
    matchEnded: md.matchEnded,
    matchStarted: md.matchStarted,
    statusText: md.status,
    dataSource: 'cricapi',
  };
}
