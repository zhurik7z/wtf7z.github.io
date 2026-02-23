# SoundCloud backend

1. Copy `.env.example` to `.env`.
2. Optional: set `SOUNDCLOUD_CLIENT_ID` + `SOUNDCLOUD_CLIENT_SECRET` (if invalid, server will fallback to a public SoundCloud client id).
3. Install dependencies: `npm install`
4. Run server: `npm run dev`

By default server starts on `http://localhost:8787`.

Endpoints:
- `GET /api/health`
- `GET /api/soundcloud/search?q=track`
- `GET /api/soundcloud/stream?url=<transcoding_url>`
