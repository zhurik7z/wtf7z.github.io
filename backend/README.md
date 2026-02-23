# Backend API

## Setup
1. Copy `.env.example` to `.env` (optional for SoundCloud OAuth).
2. Install deps: `npm install`
3. Run: `npm run dev`

Default URL: `http://localhost:8787`

## Endpoints
- `GET /api/health`
- `GET /api/soundcloud/search?q=track`
- `GET /api/soundcloud/stream?url=<transcoding_url>`
- `GET /api/comments`
- `POST /api/comments` with JSON `{ "author": "name", "text": "message" }`
- `GET /api/presence`
- `POST /api/presence` with JSON `{ "tabId": "...", "name": "..." }`
- `DELETE /api/presence/:tabId`

## Notes
- Comments are persisted in `backend/data/comments.json`.
- Online presence is in-memory (real-time, auto-expires).
- To make comments/online shared on GitHub Pages, deploy this backend (Render/Railway) and set `window.WTF7Z_API_BASE` in `index.html` to that backend URL.
