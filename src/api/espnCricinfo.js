const BASE_URL = import.meta.env.VITE_ESPN_BASE_URL || 'https://espncricinfo-api.p.rapidapi.com';
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = import.meta.env.VITE_RAPIDAPI_HOST || 'espncricinfo-api.p.rapidapi.com';

const HEADERS = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': RAPIDAPI_HOST,
  'Content-Type': 'application/json',
};

export class EspnApiError extends Error {
  constructor(message, status, retryAfter = null) {
    super(message);
    this.name = 'EspnApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

let loggedSample = false;

function logSample(endpoint, data) {
  if (import.meta.env.DEV && !loggedSample) {
    console.log(`[ESPN API] ${endpoint} sample:`, data);
    loggedSample = true;
  }
}

async function apiFetch(path, options = {}) {
  if (!RAPIDAPI_KEY) {
    throw new EspnApiError('Missing RapidAPI key', 401);
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...HEADERS, ...options.headers },
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '30', 10);
    throw new EspnApiError(data.message || 'Too many requests', 429, retryAfter);
  }

  if (!res.ok) {
    throw new EspnApiError(data.message || res.statusText, res.status);
  }

  logSample(path, data);
  return data;
}

export async function fetchHealthCheck() {
  return apiFetch('/api/v1/healthCheck');
}

export async function fetchLiveScores() {
  return apiFetch('/api/v1/liveScores');
}

export async function fetchMatchInfo(matchId) {
  return apiFetch(`/api/v1/matchInfo?matchId=${encodeURIComponent(matchId)}`);
}

export async function fetchSeriesDetails(seriesId) {
  return apiFetch(`/api/v1/series-details?series_id=${encodeURIComponent(seriesId)}`);
}

export async function searchPlayers(query) {
  return apiFetch(`/api/v1/searchPlayers?query=${encodeURIComponent(query)}`);
}

/** Health via liveScores when dedicated health endpoint is unavailable */
export async function checkApiHealth() {
  try {
    await fetchHealthCheck();
    return true;
  } catch (err) {
    if (err.status === 404) {
      try {
        await fetchLiveScores();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export function hasApiCredentials() {
  return Boolean(RAPIDAPI_KEY);
}
