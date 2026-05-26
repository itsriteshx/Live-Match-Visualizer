import { ZONES } from './constants.js';

/** Minimal shell — only API-filled fields are shown in the UI */
export function createEmptyMatchState() {
  const zoneRuns = {};
  ZONES.forEach((z) => { zoneRuns[z] = 0; });

  return {
    matchId: null,
    matchName: '',
    matchNumber: '',
    venue: '',
    seriesName: '',
    teams: {
      a: { name: '—', short: '—', color: '#00e5ff' },
      b: { name: '—', short: '—', color: '#ffd000' },
    },
    battingTeam: 'a',
    score: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    target: null,
    crr: null,
    rrr: null,
    currentOver: [],
    allOvers: [],
    players: [],
    partnership: { runs: 0, balls: 0 },
    lastFiveOversRuns: 0,
    fours: 0,
    sixes: 0,
    dots: 0,
    totalBalls: 0,
    wagonWheelShots: [],
    zoneRuns,
    winProbability: [],
    events: [],
    matchPhase: '',
    lastWicket: null,
    matchDNA: {
      a: [
        { axis: 'Aggression', val: 50 },
        { axis: 'Risk Taking', val: 50 },
        { axis: 'Consistency', val: 50 },
        { axis: 'Pressure Handling', val: 50 },
        { axis: 'Powerplay Impact', val: 50 },
      ],
      b: [
        { axis: 'Aggression', val: 50 },
        { axis: 'Risk Taking', val: 50 },
        { axis: 'Consistency', val: 50 },
        { axis: 'Pressure Handling', val: 50 },
        { axis: 'Powerplay Impact', val: 50 },
      ],
    },
    matchEnded: false,
    matchStarted: false,
    statusText: '',
    dataSource: 'cricapi',
    simulating: false,
  };
}
