import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

const tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

const publicClientIdCache = {
  value: null,
  expiresAt: 0,
};

app.use(cors());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "wtf7z-soundcloud-proxy",
    oauthConfigured: Boolean(clientId && clientSecret),
  });
});

async function getAccessToken() {
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);

  const response = await fetch("https://secure.soundcloud.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  if (!response.ok) {
    const text = await readErrorBody(response);
    throw new Error(`OAuth token request failed: ${text}`);
  }

  const payload = await response.json();
  if (!payload?.access_token) {
    throw new Error("OAuth token response did not include access_token");
  }

  const expiresIn = Number(payload.expires_in || 3600);
  tokenCache.accessToken = payload.access_token;
  tokenCache.expiresAt = now + expiresIn * 1000;
  return tokenCache.accessToken;
}

async function soundCloudFetch(url) {
  if (clientId) {
    const primary = await fetchWithClientId(url, clientId, true);
    if (primary.status !== 401 && primary.status !== 403) {
      return primary;
    }
  }

  const publicClientId = await getPublicClientId();
  if (!publicClientId) {
    throw new Error("No valid SoundCloud client_id is available");
  }
  return fetchWithClientId(url, publicClientId, false);
}

async function fetchWithClientId(url, currentClientId, withOAuth) {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set("client_id", currentClientId);

  let headers;
  if (withOAuth) {
    try {
      const token = await getAccessToken();
      if (token) {
        headers = { Authorization: `Bearer ${token}` };
      }
    } catch {
      headers = undefined;
    }
  }

  return fetch(requestUrl, { headers });
}

async function getPublicClientId() {
  const now = Date.now();
  if (publicClientIdCache.value && publicClientIdCache.expiresAt > now) {
    return publicClientIdCache.value;
  }

  const htmlResponse = await fetch("https://soundcloud.com");
  if (!htmlResponse.ok) {
    return null;
  }
  const html = await htmlResponse.text();
  const assetMatches = html.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"' ]+\.js/g) || [];
  const assets = [...new Set(assetMatches)].slice(0, 20);

  for (const assetUrl of assets) {
    try {
      const assetResponse = await fetch(assetUrl);
      if (!assetResponse.ok) continue;
      const assetText = await assetResponse.text();
      const match = assetText.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{32})"/);
      if (!match?.[1]) continue;
      publicClientIdCache.value = match[1];
      publicClientIdCache.expiresAt = now + 60 * 60 * 1000;
      return publicClientIdCache.value;
    } catch {
      // ignore and continue to next asset
    }
  }

  return null;
}

app.get("/api/soundcloud/search", async (req, res) => {
  const q = String(req.query.q || "").trim();

  if (q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  try {
    const searchUrl = new URL("https://api-v2.soundcloud.com/search/tracks");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("limit", "12");
    searchUrl.searchParams.set("linked_partitioning", "1");

    const response = await soundCloudFetch(searchUrl.toString());
    if (!response.ok) {
      const text = await readErrorBody(response);
      res.status(502).json({ error: `SoundCloud search failed: ${text}` });
      return;
    }

    const payload = await response.json();
    const collection = Array.isArray(payload.collection) ? payload.collection : [];

    const tracks = collection
      .map((track) => {
        const transcodings = track?.media?.transcodings || [];
        const progressive = transcodings.find((item) => item?.format?.protocol === "progressive");
        if (!progressive?.url) return null;

        return {
          id: track.id,
          title: track.title || "Unknown",
          artist: track?.user?.username || "Unknown",
          artwork: track.artwork_url || null,
          permalink: track.permalink_url || null,
          streamProxyUrl: `/api/soundcloud/stream?url=${encodeURIComponent(progressive.url)}`,
        };
      })
      .filter(Boolean);

    res.json({ tracks });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected error" });
  }
});

app.get("/api/soundcloud/stream", async (req, res) => {
  const transcodingUrl = String(req.query.url || "").trim();

  if (!transcodingUrl) {
    res.status(400).json({ error: "Missing transcoding url" });
    return;
  }

  try {
    const response = await soundCloudFetch(transcodingUrl);
    if (!response.ok) {
      const text = await readErrorBody(response);
      res.status(502).json({ error: `SoundCloud stream resolve failed: ${text}` });
      return;
    }

    const payload = await response.json();
    if (!payload?.url) {
      res.status(502).json({ error: "No playable URL returned by SoundCloud" });
      return;
    }

    res.json({ url: payload.url });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected error" });
  }
});

app.listen(port, () => {
  console.log(`SoundCloud proxy is running on http://localhost:${port}`);
});
async function readErrorBody(response) {
  try {
    const text = await response.text();
    if (text && text.trim().length > 0 && text.trim() !== "{}") {
      return text.slice(0, 220);
    }
  } catch {
    // ignore
  }
  return `HTTP ${response.status}`;
}
