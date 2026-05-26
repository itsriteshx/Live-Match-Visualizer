import { createEmptyMatchState } from '../data/emptyMatchState.js';

function pick(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function parseOvers(oversStr) {
  if (oversStr == null) return { overs: 0, balls: 0 };
  if (typeof oversStr === 'number') {
    const whole = Math.floor(oversStr);
    const balls = Math.round((oversStr - whole) * 6);
    return { overs: whole, balls: balls >= 6 ? 0 : balls };
  }
  const str = String(oversStr);
  const dot = str.split('.');
  return { overs: parseInt(dot[0], 10) || 0, balls: parseInt(dot[1], 10) || 0 };
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function inferAura(sr, wickets) {
  if (wickets >= 2) return 'hot-streak';
  if (sr >= 150) return 'hot-streak';
  if (sr < 100 && sr > 0) return 'under-pressure';
  if (sr >= 130) return 'clutch';
  return 'normal';
}

function mapPlayers(batters = [], bowlers = [], fallbackPlayers = []) {
  const players = [];

  batters.forEach((b, i) => {
    const name = pick(b.name, b.batsman?.name, b.batsmanName, b.playerName) || `Batter ${i + 1}`;
    const runs = pick(b.runs, b.r) ?? 0;
    const balls = pick(b.balls, b.b) ?? 0;
    const sr = pick(b.strikeRate, b.sr, b.SR, balls > 0 ? ((runs / balls) * 100).toFixed(1) : 0);
    const fb = fallbackPlayers.find((p) => p.role === 'BATTER' && p.name === name);
    players.push({
      name,
      role: 'BATTER',
      runs,
      balls,
      sr: typeof sr === 'number' ? sr : parseFloat(sr) || 0,
      aura: fb?.aura || inferAura(parseFloat(sr), 0),
      form: fb?.form || ['good', 'na', 'good', 'poor', 'good'],
      initials: initials(name),
      color: fb?.color || '#1a7a3a',
      photoUrl: pick(b.photoUrl, b.imageUrl, b.playerImage, fb?.photoUrl) || null,
    });
  });

  bowlers.forEach((b, i) => {
    const name = pick(b.name, b.bowler?.name, b.bowlerName, b.playerName) || `Bowler ${i + 1}`;
    const overs = pick(b.overs, b.o) ?? 0;
    const runsConceded = pick(b.runs, b.runsConceded, b.conceded) ?? 0;
    const wkts = pick(b.wickets, b.wkts, b.w) ?? 0;
    const fb = fallbackPlayers.find((p) => p.role === 'BOWLER' && p.name === name);
    players.push({
      name,
      role: 'BOWLER',
      overs,
      runsConceded,
      wkts,
      aura: fb?.aura || inferAura(0, wkts),
      form: fb?.form || ['good', 'good', 'na', 'poor', 'good'],
      initials: initials(name),
      color: fb?.color || '#004ba0',
      photoUrl: pick(b.photoUrl, b.imageUrl, b.playerImage, fb?.photoUrl) || null,
    });
  });

  return players.length ? players : fallbackPlayers;
}

export function extractLiveMatches(liveScoresData) {
  const raw =
    liveScoresData?.matches ??
    liveScoresData?.data?.matches ??
    liveScoresData?.data ??
    liveScoresData?.liveScores ??
    liveScoresData?.results ??
    (Array.isArray(liveScoresData) ? liveScoresData : []);

  if (!Array.isArray(raw)) return [];

  return raw.map((m, i) => {
    const id = pick(m.matchId, m.id, m.match_id, m.gameId, String(i));
    const team1 = pick(m.team1?.name, m.teams?.[0]?.name, m.team1Name, m.team1);
    const team2 = pick(m.team2?.name, m.teams?.[1]?.name, m.team2Name, m.team2);
    const venue = pick(m.venue?.name, m.venue, m.ground, m.location);
    const seriesName = pick(m.seriesName, m.series?.name, m.series);
    const status = pick(m.status, m.state, m.matchStatus);
    const score1 = pick(m.team1?.score, m.scores?.[0], m.score);
    const score2 = pick(m.team2?.score, m.scores?.[1]);

    const label = team1 && team2
      ? `${team1} vs ${team2}${venue ? ` — ${venue}` : ''}`
      : pick(m.matchDescription, m.title, m.name, `Match ${id}`);

    return {
      matchId: String(id),
      label,
      team1,
      team2,
      venue,
      seriesName,
      status,
      score1,
      score2,
      seriesId: pick(m.seriesId, m.series_id, m.series?.id),
      raw: m,
    };
  });
}

export function mapMatchInfoToState(matchInfoData, fallback = createEmptyMatchState()) {
  const d = matchInfoData?.data ?? matchInfoData?.match ?? matchInfoData ?? {};

  const team1Name = pick(
    d.team1?.name,
    d.teams?.[0]?.name,
    d.teamInfo?.[0]?.name,
    d.batting?.team,
    fallback.teams.a.name,
  );
  const team2Name = pick(
    d.team2?.name,
    d.teams?.[1]?.name,
    d.teamInfo?.[1]?.name,
    fallback.teams.b.name,
  );
  const team1Short = pick(d.team1?.shortName, d.team1?.shortname, d.teams?.[0]?.shortName, fallback.teams.a.short);
  const team2Short = pick(d.team2?.shortName, d.team2?.shortname, d.teams?.[1]?.shortName, fallback.teams.b.short);

  const sc0 = d.scorecard?.[0] ?? d.innings?.[0] ?? d.score?.[0] ?? {};
  const sc1 = d.scorecard?.[1] ?? d.innings?.[1] ?? d.score?.[1] ?? {};

  const battingIdx = sc0.isBatting || sc0.batting ? 0 : sc1.isBatting || sc1.batting ? 1 : 0;
  const battingSc = battingIdx === 0 ? sc0 : sc1;

  const score = pick(battingSc.runs, battingSc.r, d.score, d.totalRuns, fallback.score) ?? fallback.score;
  const wickets = pick(battingSc.wickets, battingSc.w, fallback.wickets) ?? fallback.wickets;
  const { overs, balls } = parseOvers(pick(battingSc.overs, battingSc.o, d.overs, fallback.overs + fallback.balls / 6));

  const battersRaw =
    d.batting?.batsmenData ??
    d.batting?.batsmen ??
    d.batsmen ??
    d.currentBatsmen ??
    [];
  const bowlersRaw =
    d.bowling?.bowlersData ??
    d.bowling?.bowlers ??
    d.bowlers ??
    d.currentBowlers ??
    [];

  const crr = pick(d.currentRunRate, d.CRR, d.crr, fallback.crr);
  const rrr = pick(d.requiredRunRate, d.RRR, d.rrr, fallback.rrr);

  const partnership = {
    runs: pick(d.partnerships?.runs, d.partnership?.runs, fallback.partnership.runs) ?? fallback.partnership.runs,
    balls: pick(d.partnerships?.balls, d.partnership?.balls, fallback.partnership.balls) ?? fallback.partnership.balls,
  };

  const players = mapPlayers(
    Array.isArray(battersRaw) ? battersRaw : Object.values(battersRaw || {}),
    Array.isArray(bowlersRaw) ? bowlersRaw : Object.values(bowlersRaw || {}),
    fallback.players,
  );

  const matchId = pick(d.matchId, d.id, d.match_id, fallback.matchId);
  const venue = pick(d.matchHeader?.venue?.name, d.venue?.name, d.venue, fallback.venue);
  const seriesName = pick(d.matchHeader?.seriesName, d.seriesName, d.series?.name, fallback.seriesName);
  const matchName = pick(d.matchHeader?.matchDescription, d.matchDescription, d.title, fallback.matchName);
  const matchNumber = pick(d.matchHeader?.matchNumber, d.matchNumber, fallback.matchNumber);
  const target = pick(d.target, d.requiredRuns, fallback.target);

  return {
    ...fallback,
    matchId,
    matchName,
    matchNumber,
    venue,
    seriesName,
    seriesId: pick(d.seriesId, d.series_id, fallback.seriesId),
    teams: {
      a: {
        name: battingIdx === 0 ? team1Name : team2Name,
        short: battingIdx === 0 ? team1Short : team2Short,
        color: fallback.teams.a.color,
      },
      b: {
        name: battingIdx === 0 ? team2Name : team1Name,
        short: battingIdx === 0 ? team2Short : team1Short,
        color: fallback.teams.b.color,
      },
    },
    score: Number(score) || 0,
    wickets: Number(wickets) || 0,
    overs,
    balls,
    target: target != null ? Number(target) : fallback.target,
    crr: crr != null ? Number(crr) : fallback.crr,
    rrr: rrr != null ? Number(rrr) : fallback.rrr,
    partnership,
    lastWicket: pick(d.lastWicket, d.lastWicketText, fallback.lastWicket),
    players: players.length >= 2 ? players : fallback.players,
    dataSource: 'live',
    simulating: false,
  };
}

export function mergeLiveScoreIntoState(state, liveMatch) {
  if (!liveMatch?.raw) return state;
  const m = liveMatch.raw;
  const scoreStr = pick(m.score, m.team1?.score, m.status);
  if (typeof scoreStr === 'string' && scoreStr.includes('/')) {
    const [r, w] = scoreStr.split('/').map((x) => parseInt(x.trim(), 10));
    if (!Number.isNaN(r)) {
      return {
        ...state,
        score: r,
        wickets: Number.isNaN(w) ? state.wickets : w,
        venue: liveMatch.venue || state.venue,
        seriesName: liveMatch.seriesName || state.seriesName,
        matchName: liveMatch.label || state.matchName,
      };
    }
  }
  return {
    ...state,
    venue: liveMatch.venue || state.venue,
    seriesName: liveMatch.seriesName || state.seriesName,
    matchName: liveMatch.label || state.matchName,
  };
}

export function mapPlayerSearch(data) {
  const list = data?.players ?? data?.data ?? data?.results ?? (Array.isArray(data) ? data : []);
  const first = Array.isArray(list) ? list[0] : list;
  if (!first) return null;
  return {
    photoUrl: pick(first.photoUrl, first.imageUrl, first.playerImage, first.img),
    country: pick(first.country, first.countryName),
    role: pick(first.role, first.playerRole),
    age: pick(first.age, first.playerAge),
  };
}

export function getScoreSignature(state) {
  return `${state.matchId}:${state.score}/${state.wickets}@${state.overs}.${state.balls}`;
}
