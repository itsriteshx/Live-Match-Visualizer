import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchCurrentMatches,
  fetchMatchScorecard,
  hasCricApiKey,
  CricApiError,
} from '../api/cricApi.js';
import { createEmptyMatchState } from '../data/emptyMatchState.js';
import { API_STATUS, POLL_INTERVAL_MS } from '../data/constants.js';
import {
  extractCricApiMatches,
  mapCricApiScorecard,
  mapCricApiFromListMatch,
} from '../utils/cricApiMapper.js';
import { getScoreSignature } from '../utils/matchMapper.js';

const CACHE_KEY = 'cricapi_match_cache_v2';

function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(state, matches) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ state, matches, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function useLiveCricket() {
  const [matchState, setMatchState] = useState(() => loadCache()?.state ?? createEmptyMatchState());
  const [liveMatches, setLiveMatches] = useState(() => loadCache()?.matches ?? []);
  const [selectedMatchId, setSelectedMatchId] = useState(
    () => loadCache()?.state?.matchId ?? null,
  );
  const [apiStatus, setApiStatus] = useState(API_STATUS.LOADING);
  const [apiErrorMessage, setApiErrorMessage] = useState(null);
  const [reconnectCountdown, setReconnectCountdown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());
  const [dataTransition, setDataTransition] = useState(false);
  const [scorePulse, setScorePulse] = useState(false);
  const prevScoreSig = useRef(getScoreSignature(matchState));
  const mounted = useRef(true);

  const applyState = useCallback((next, matches = liveMatches) => {
    const sig = getScoreSignature(next);
    if (sig !== prevScoreSig.current) {
      setScorePulse(true);
      setTimeout(() => mounted.current && setScorePulse(false), 1000);
      prevScoreSig.current = sig;
    }
    setMatchState(next);
    saveCache(next, matches);
    setLastUpdated(Date.now());
  }, [liveMatches]);

  const fallbackToCache = useCallback((message) => {
    const cached = loadCache();
    if (cached?.state?.matchId) {
      setApiStatus(API_STATUS.CACHED);
      setApiErrorMessage(message);
      applyState(cached.state, cached.matches || []);
      return true;
    }
    setApiStatus(API_STATUS.ERROR);
    setApiErrorMessage(message);
    setMatchState(createEmptyMatchState());
    return false;
  }, [applyState]);

  const loadCricApiMatch = useCallback(async (matchId, matches, useFade = false) => {
    if (useFade) setDataTransition(true);
    const listEntry = matches.find((m) => m.matchId === matchId);

    try {
      const card = await fetchMatchScorecard(matchId);
      const mapped = mapCricApiScorecard(card, listEntry);
      mapped.matchId = matchId;
      setApiStatus(API_STATUS.CRICAPI);
      setApiErrorMessage(null);
      applyState(mapped, matches);
    } catch {
      if (listEntry?.raw) {
        const mapped = mapCricApiFromListMatch(listEntry.raw);
        mapped.matchId = matchId;
        setApiStatus(API_STATUS.CRICAPI);
        setApiErrorMessage('Scorecard unavailable — showing match summary');
        applyState(mapped, matches);
      } else {
        throw new CricApiError('Failed to load match', 500);
      }
    } finally {
      if (useFade) setTimeout(() => mounted.current && setDataTransition(false), 400);
    }
  }, [applyState]);

  const refreshLiveScores = useCallback(async (isPoll = false) => {
    if (!hasCricApiKey()) {
      setApiStatus(API_STATUS.ERROR);
      setApiErrorMessage('Missing VITE_CRICAPI_KEY in .env');
      setLoading(false);
      return;
    }

    setLoading(!isPoll);
    try {
      const data = await fetchCurrentMatches();
      const matches = extractCricApiMatches(data);

      if (!matches.length) {
        throw new CricApiError('No matches in currentMatches response', 404);
      }

      setLiveMatches(matches);

      let matchId = selectedMatchId;
      const liveMatch = matches.find((m) => m.isLive);
      if (!matchId || !matches.some((m) => m.matchId === matchId)) {
        matchId = (liveMatch || matches[0]).matchId;
        setSelectedMatchId(matchId);
      }

      await loadCricApiMatch(matchId, matches, false);
    } catch (err) {
      const msg = err?.message || String(err);
      if (import.meta.env.DEV) console.warn('[CricAPI]', msg);
      fallbackToCache(msg);
      if (err?.name === 'TypeError') {
        setApiStatus(API_STATUS.RECONNECTING);
        setReconnectCountdown(30);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedMatchId, loadCricApiMatch, fallbackToCache]);

  useEffect(() => {
    mounted.current = true;
    const init = async () => { await refreshLiveScores(false); };
    void init();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (apiStatus !== API_STATUS.RECONNECTING || reconnectCountdown <= 0) return undefined;
    const t = setInterval(() => {
      setReconnectCountdown((c) => {
        if (c <= 1) {
          refreshLiveScores(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [apiStatus, reconnectCountdown, refreshLiveScores]);

  useEffect(() => {
    if (apiStatus !== API_STATUS.CRICAPI) return undefined;
    const id = setInterval(() => refreshLiveScores(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [apiStatus, refreshLiveScores]);

  const selectMatch = useCallback(async (matchId) => {
    setSelectedMatchId(matchId);
    setLoading(true);
    try {
      await loadCricApiMatch(matchId, liveMatches, true);
    } catch (err) {
      fallbackToCache(err?.message);
    } finally {
      setLoading(false);
    }
  }, [liveMatches, loadCricApiMatch, fallbackToCache]);

  return {
    matchState,
    liveMatches,
    selectedMatchId: selectedMatchId || matchState.matchId,
    selectMatch,
    apiStatus,
    apiErrorMessage,
    reconnectCountdown,
    loading,
    lastUpdated,
    dataTransition,
    scorePulse,
  };
}
