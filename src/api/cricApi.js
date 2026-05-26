const BASE = 'https://api.cricapi.com/v1';
const API_KEY = import.meta.env.VITE_CRICAPI_KEY || '';

export class CricApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'CricApiError';
    this.status = status;
  }
}

export function hasCricApiKey() {
  return Boolean(API_KEY);
}

async function cricFetch(path) {
  if (!API_KEY) throw new CricApiError('Missing CricAPI key', 401);
  const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}apikey=${API_KEY}`);
  const data = await res.json();
  if (data.status !== 'success') {
    throw new CricApiError(data.reason || data.message || 'CricAPI request failed', res.status);
  }
  if (import.meta.env.DEV && path.includes('currentMatches')) {
    console.log('[CricAPI] currentMatches loaded:', data?.data?.length, 'matches');
  }
  return data;
}

export async function fetchCurrentMatches() {
  return cricFetch('/currentMatches?offset=0');
}

export async function fetchMatchScorecard(id) {
  return cricFetch(`/match_scorecard?id=${encodeURIComponent(id)}`);
}
