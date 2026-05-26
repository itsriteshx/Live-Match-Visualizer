# Live Match Visualizer

Live cricket analytics dashboard powered by [CricAPI](https://www.cricapi.com/).

## Setup

```bash
npm install
cp .env.example .env   # add your CricAPI key
npm run dev
```

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_CRICAPI_KEY` | API key from [cricapi.com](https://www.cricapi.com/) |

## Data flow

1. **On load** — `GET /v1/currentMatches` → match dropdown
2. **Per match** — `GET /v1/match_scorecard?id={matchId}` → scoreboard, players, stats
3. **Every 30s** — silent refresh of current matches + selected scorecard

Status badge: **● LIVE CRICAPI** when connected. All scores come from the API — no mock/demo data. On error, shows cached data or an empty error state.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
