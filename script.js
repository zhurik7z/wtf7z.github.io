const storageKeys = {
  users: "wtf7z-users",
  session: "wtf7z-session",
  comments: "wtf7z-comments",
  presence: "wtf7z-presence",
};
const defaultApiBase = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? "http://localhost:8787"
  : "";
const API_BASE = (window.WTF7Z_API_BASE || defaultApiBase).replace(/\/$/, "");
const SOUND_CLOUD_PUBLIC_CLIENT_IDS = [
  "XiD3LeYoTKN7rIqQi5aDtnwz9t9zcDYw",
];
const CORS_PROXY_PREFIXES = [
  "https://api.allorigins.win/raw?url=",
  "https://cors.isomorphic-git.org/",
];

const baseTracks = [];

const notificationItems = [
  "Добро пожаловать на сайт NoName",
  "Можно зарегистрироваться и оставлять комментарии",
  "Тут так же есть поиск треков",
];

const audio = document.getElementById("audio");
const playlistEl = document.getElementById("playlist");
const musicSearchForm = document.getElementById("musicSearchForm");
const musicQuery = document.getElementById("musicQuery");
const searchStatus = document.getElementById("searchStatus");
const searchResults = document.getElementById("searchResults");

const notifyBtn = document.getElementById("notifyBtn");
const notifyPanel = document.getElementById("notifyPanel");
const notifyList = document.getElementById("notifyList");
const notifyDot = document.getElementById("notifyDot");

const showLogin = document.getElementById("showLogin");
const showRegister = document.getElementById("showRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginName = document.getElementById("loginName");
const loginPass = document.getElementById("loginPass");
const registerName = document.getElementById("registerName");
const registerPass = document.getElementById("registerPass");
const authStatus = document.getElementById("authStatus");
const logoutBtn = document.getElementById("logoutBtn");

const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentList = document.getElementById("commentList");

const onlineCount = document.getElementById("onlineCount");
const onlineList = document.getElementById("onlineList");

const tabId = typeof crypto !== "undefined" && crypto.randomUUID
  ? crypto.randomUUID()
  : `tab-${Math.random().toString(36).slice(2)}`;

const channel = typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel("wtf7z-online")
  : null;

let playlist = [...baseTracks];
let currentTrack = 0;
let currentUser = loadSession();
const memoryStore = new Map();

function canUseLocalStorage() {
  try {
    const key = "__wtf7z_probe__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const hasLocalStorage = canUseLocalStorage();

function getCookieValue(name) {
  try {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function setCookieValue(name, value, days = 30) {
  try {
    const maxAge = Math.max(1, Math.floor(days * 24 * 60 * 60));
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
    return true;
  } catch {
    return false;
  }
}

function removeCookieValue(name) {
  try {
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  } catch {
    // ignore
  }
}

function loadJSON(key, fallback) {
  try {
    const raw = hasLocalStorage
      ? localStorage.getItem(key) || getCookieValue(key)
      : memoryStore.get(key) || getCookieValue(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  const raw = JSON.stringify(value);
  memoryStore.set(key, raw);
  let saved = false;
  if (hasLocalStorage) {
    try {
      localStorage.setItem(key, raw);
      saved = true;
    } catch {
      saved = false;
    }
  }
  if (setCookieValue(key, raw)) {
    saved = true;
  }
  return saved;
}

function loadUsers() {
  const users = loadJSON(storageKeys.users, []);
  if (!users.some((u) => u.username === "wtf7z")) {
    users.push({ username: "wtf7z", password: "123456" });
    saveJSON(storageKeys.users, users);
  }
  return users;
}

function loadSession() {
  return loadJSON(storageKeys.session, null);
}

function saveSession(user) {
  if (user) {
    saveJSON(storageKeys.session, user);
  } else {
    memoryStore.delete(storageKeys.session);
    if (hasLocalStorage) {
      localStorage.removeItem(storageKeys.session);
    }
    removeCookieValue(storageKeys.session);
  }
}

function renderNotifications() {
  notifyList.innerHTML = "";
  notificationItems.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    notifyList.appendChild(li);
  });
}

function pushNotification(text) {
  notificationItems.unshift(text);
  if (notificationItems.length > 8) notificationItems.pop();
  notifyDot.classList.remove("hidden");
  renderNotifications();
}

function setTrack(index) {
  if (!playlist[index]) return;
  currentTrack = index;
  audio.src = playlist[index].url;
  [...playlistEl.querySelectorAll("button")].forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });
}

function renderPlaylist() {
  playlistEl.innerHTML = "";

  if (!playlist.length) {
    const li = document.createElement("li");
    li.textContent = "Плейлист пуст.";
    playlistEl.appendChild(li);
    return;
  }

  playlist.forEach((track, index) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "track-btn";
    btn.textContent = `${index + 1}. ${track.title} - ${track.artist}`;
    btn.addEventListener("click", () => {
      setTrack(index);
      audio.play();
    });
    li.appendChild(btn);
    playlistEl.appendChild(li);
  });

  setTrack(Math.min(currentTrack, playlist.length - 1));
}

function addTrack(track) {
  const exists = playlist.some((item) => item.url === track.url);
  if (!exists) {
    playlist.unshift(track);
    renderPlaylist();
  }
  setTrack(0);
  audio.play();
}

async function findMusic(query) {
  if (API_BASE) {
    const endpoint = `${API_BASE}/api/soundcloud/search?q=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.tracks) ? data.tracks : [];
      }
    } catch {
      // fallback to direct SoundCloud request
    }
  }

  return searchTracksDirect(query);
}

async function prepareTrack(track) {
  if (track.url) return track;
  if (track.streamProxyUrl && API_BASE) {
    const endpoint = `${API_BASE}${track.streamProxyUrl}`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("Не удалось получить поток");
    const payload = await response.json();
    if (!payload?.url) throw new Error("Поток недоступен");
    return {
      title: track.title,
      artist: track.artist,
      url: payload.url,
    };
  }

  if (!track.streamApiUrl) throw new Error("Нет stream URL");
  const payload = await resolveStreamDirect(track.streamApiUrl, track.trackAuthorization || "");
  if (!payload?.url) throw new Error("Поток недоступен");

  return {
    title: track.title,
    artist: track.artist,
    url: payload.url,
  };
}

async function searchTracksDirect(query) {
  const payload = await callWithPublicClientId(async (clientId) => {
    const endpoint = new URL("https://api-v2.soundcloud.com/search/tracks");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("limit", "12");
    endpoint.searchParams.set("linked_partitioning", "1");
    endpoint.searchParams.set("client_id", clientId);
    const response = await fetchWithCorsFallback(endpoint.toString());
    if (!response.ok) throw new Error("SEARCH_FAILED");
    return response.json();
  });

  const collection = Array.isArray(payload?.collection) ? payload.collection : [];
  return collection
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
        streamApiUrl: progressive.url,
        trackAuthorization: track.track_authorization || "",
      };
    })
    .filter(Boolean);
}

async function resolveStreamDirect(streamApiUrl, trackAuthorization) {
  return callWithPublicClientId(async (clientId) => {
    const endpoint = new URL(streamApiUrl);
    endpoint.searchParams.set("client_id", clientId);
    if (trackAuthorization) {
      endpoint.searchParams.set("track_authorization", trackAuthorization);
    }
    const response = await fetchWithCorsFallback(endpoint.toString());
    if (!response.ok) throw new Error("STREAM_FAILED");
    return response.json();
  });
}

async function callWithPublicClientId(callback) {
  let lastError = null;
  for (const clientId of SOUND_CLOUD_PUBLIC_CLIENT_IDS) {
    try {
      return await callback(clientId);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("NO_PUBLIC_CLIENT_ID");
}

async function fetchWithCorsFallback(url) {
  try {
    return await fetch(url);
  } catch {
    // fallback to public proxies for static hosting (GitHub Pages)
  }

  for (const prefix of CORS_PROXY_PREFIXES) {
    try {
      const proxiedUrl = prefix.includes("allorigins")
        ? `${prefix}${encodeURIComponent(url)}`
        : `${prefix}${url}`;
      const response = await fetch(proxiedUrl);
      if (response.ok) return response;
    } catch {
      // try next proxy
    }
  }

  throw new Error("NETWORK_OR_CORS_BLOCKED");
}

function renderSearchResults(items) {
  searchResults.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "Ничего не найдено.";
    searchResults.appendChild(li);
    return;
  }

  items.forEach((track) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-track";
    btn.textContent = `${track.title} - ${track.artist}`;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = `Добавляю: ${track.title}...`;

      try {
        const prepared = await prepareTrack(track);
        addTrack(prepared);
        pushNotification(`Добавлен трек: ${track.title}`);
        searchStatus.textContent = `Трек добавлен: ${track.title}`;
      } catch {
        searchStatus.textContent = "Не удалось добавить трек в плеер.";
      } finally {
        btn.disabled = false;
        btn.textContent = `${track.title} - ${track.artist}`;
      }
    });
    li.appendChild(btn);
    searchResults.appendChild(li);
  });
}

function switchAuth(mode) {
  const showLoginForm = mode === "login";
  loginForm.classList.toggle("hidden", !showLoginForm);
  registerForm.classList.toggle("hidden", showLoginForm);
  showLogin.classList.toggle("active", showLoginForm);
  showRegister.classList.toggle("active", !showLoginForm);
}

const remoteSyncEnabled = Boolean(API_BASE);

function setPresence(name) {
  const map = loadPresenceMap();
  map[tabId] = { name, seenAt: Date.now() };
  saveJSON(storageKeys.presence, map);
  if (channel) channel.postMessage("update");

  if (remoteSyncEnabled) {
    sendPresenceRemote(name).catch(() => {
      // ignore, local fallback still works
    });
  }
}

function cleanupPresence(map) {
  const now = Date.now();
  const cleaned = {};
  Object.entries(map).forEach(([id, item]) => {
    if (!item || typeof item !== "object") return;
    if (typeof item.name !== "string" || typeof item.seenAt !== "number") return;
    if (now - item.seenAt < 35000) cleaned[id] = item;
  });
  return cleaned;
}

async function renderOnline() {
  if (remoteSyncEnabled) {
    try {
      const response = await fetch(`${API_BASE}/api/presence`);
      if (response.ok) {
        const payload = await response.json();
        renderOnlineEntries(
          Number(payload.onlineCount) || 0,
          Array.isArray(payload.users) ? payload.users : [],
        );
        return;
      }
    } catch {
      // fallback to local presence
    }
  }

  const cleaned = cleanupPresence(loadPresenceMap());
  saveJSON(storageKeys.presence, cleaned);

  const grouped = {};
  Object.values(cleaned).forEach((user) => {
    grouped[user.name] = (grouped[user.name] || 0) + 1;
  });

  const entries = Object.entries(grouped)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  renderOnlineEntries(Object.keys(cleaned).length, entries);
}

function renderAuth() {
  const username = currentUser?.username;
  authStatus.textContent = username ? `Авторизован: ${username}` : "Не авторизован";
  logoutBtn.classList.toggle("hidden", !username);
  commentForm.classList.toggle("hidden", !username);

  if (username) {
    switchAuth("login");
    loginForm.classList.add("hidden");
    registerForm.classList.add("hidden");
  } else {
    switchAuth("login");
  }

  setPresence(username || "Гость");
  renderOnline();
}

function loadComments() {
  const comments = loadJSON(storageKeys.comments, []);
  return Array.isArray(comments) ? comments : [];
}

function saveComments(comments) {
  if (!Array.isArray(comments)) return false;
  return saveJSON(storageKeys.comments, comments.slice(0, 60));
}

function loadPresenceMap() {
  const map = loadJSON(storageKeys.presence, {});
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  return map;
}

async function renderComments() {
  if (remoteSyncEnabled) {
    try {
      const response = await fetch(`${API_BASE}/api/comments`);
      if (response.ok) {
        const payload = await response.json();
        const comments = Array.isArray(payload.comments) ? payload.comments : [];
        saveComments(comments);
        renderCommentList(comments);
        return;
      }
    } catch {
      // fallback to local comments
    }
  }

  const comments = loadComments();
  renderCommentList(comments);
}

function renderCommentList(comments) {
  commentList.innerHTML = "";

  if (!comments.length) {
    const li = document.createElement("li");
    li.textContent = "Пока комментариев нет.";
    commentList.appendChild(li);
    return;
  }

  comments.forEach((item) => {
    const li = document.createElement("li");
    const author = document.createElement("div");
    author.className = "comment-author";
    author.textContent = `${item.author} • ${new Date(item.time).toLocaleString("ru-RU")}`;

    const text = document.createElement("div");
    text.textContent = item.text;

    li.appendChild(author);
    li.appendChild(text);
    commentList.appendChild(li);
  });
}

function renderOnlineEntries(total, entries) {
  onlineCount.textContent = `Сейчас онлайн: ${total}`;
  onlineList.innerHTML = "";

  if (!entries.length) {
    const li = document.createElement("li");
    li.textContent = "Никого нет онлайн";
    onlineList.appendChild(li);
    return;
  }

  entries.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.name} (${item.count})`;
    onlineList.appendChild(li);
  });
}

async function sendPresenceRemote(name) {
  await fetch(`${API_BASE}/api/presence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tabId,
      name,
    }),
  });
}

showLogin.addEventListener("click", () => switchAuth("login"));
showRegister.addEventListener("click", () => switchAuth("register"));

notifyBtn.addEventListener("click", () => {
  notifyPanel.classList.toggle("hidden");
  notifyDot.classList.add("hidden");
});

audio.addEventListener("ended", () => {
  const next = (currentTrack + 1) % playlist.length;
  setTrack(next);
  audio.play();
});

musicSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = musicQuery.value.trim();
  if (q.length < 2) {
    searchStatus.textContent = "Введите минимум 2 символа.";
    return;
  }

  searchStatus.textContent = "Ищу треки в SoundCloud (будьте готовы к долгому поиску)";

  try {
    const found = await findMusic(q);
    renderSearchResults(found);
    searchStatus.textContent = `Результатов: ${found.length}`;
  } catch {
    searchStatus.textContent = "Не удалось получить треки из SoundCloud API, возможно отлетели прокси( попробуй еще раз!";
  }
});

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = registerName.value.trim();
  const password = registerPass.value.trim();
  if (username.length < 3 || password.length < 4) {
    alert("Логин от 3 символов, пароль от 4 символов");
    return;
  }

  const users = loadUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    alert("Такой логин уже есть");
    return;
  }

  users.push({ username, password });
  saveJSON(storageKeys.users, users);
  registerForm.reset();
  switchAuth("login");
  pushNotification(`Новый аккаунт создан: ${username}`);
  alert("Регистрация успешна. Теперь войдите.");
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = loginName.value.trim();
  const password = loginPass.value.trim();
  const users = loadUsers();
  const user = users.find((u) => u.username === username && u.password === password);

  if (!user) {
    alert("Неверный логин или пароль");
    return;
  }

  currentUser = { username: user.username };
  saveSession(currentUser);
  loginForm.reset();
  renderAuth();
  pushNotification(`Вход в аккаунт: ${user.username}`);
});

logoutBtn.addEventListener("click", () => {
  currentUser = null;
  saveSession(null);
  renderAuth();
  pushNotification("Вы вышли из аккаунта");
});

commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser?.username) {
    alert("Войдите в аккаунт");
    return;
  }

  const text = commentInput.value.trim();
  if (!text) return;

  if (remoteSyncEnabled) {
    try {
      const response = await fetch(`${API_BASE}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: currentUser.username,
          text,
        }),
      });

      if (!response.ok) {
        throw new Error("REMOTE_COMMENT_FAILED");
      }

      const payload = await response.json();
      const comments = Array.isArray(payload.comments) ? payload.comments : [];
      saveComments(comments);
      commentInput.value = "";
      renderCommentList(comments);
      return;
    } catch {
      // fallback to local comment save
    }
  }

  const comments = loadComments();
  comments.unshift({
    author: currentUser.username,
    text,
    time: Date.now(),
  });
  const saved = saveComments(comments);
  if (!saved) {
    alert("Не удалось сохранить комментарий.");
  }

  commentInput.value = "";
  renderCommentList(comments);
});

window.addEventListener("storage", (event) => {
  if (!remoteSyncEnabled && event.key === storageKeys.comments) {
    renderComments();
    return;
  }

  if (event.key === storageKeys.session) {
    currentUser = loadSession();
    renderAuth();
    return;
  }

  if (event.key === storageKeys.presence) {
    renderOnline();
  }
});

if (channel) {
  channel.addEventListener("message", () => renderOnline());
}

window.addEventListener("beforeunload", () => {
  const map = loadPresenceMap();
  delete map[tabId];
  saveJSON(storageKeys.presence, map);

  if (remoteSyncEnabled) {
    fetch(`${API_BASE}/api/presence/${encodeURIComponent(tabId)}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {
      // ignore
    });
  }
});

setInterval(() => {
  setPresence(currentUser?.username || "Гость");
  renderOnline();
}, 12000);

loadUsers();
renderNotifications();
renderPlaylist();
renderComments();
renderAuth();
setPresence(currentUser?.username || "Гость");
renderOnline();
