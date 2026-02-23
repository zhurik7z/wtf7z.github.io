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

const baseTracks = [
  {
    title: "Dream Pulse",
    artist: "SoundHelix",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    title: "Night Drive",
    artist: "SoundHelix",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    title: "Skyline",
    artist: "SoundHelix",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
];

const notificationItems = [
  "Добро пожаловать на сайт wtf7z",
  "Можно зарегистрироваться и оставлять комментарии",
  "Используй поиск трека, чтобы добавить музыку в плеер",
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

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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
    localStorage.removeItem(storageKeys.session);
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
  const endpoint = API_BASE
    ? `${API_BASE}/api/soundcloud/search?q=${encodeURIComponent(query)}`
    : `/api/soundcloud/search?q=${encodeURIComponent(query)}`;

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("Ошибка загрузки");
  const data = await response.json();
  return Array.isArray(data.tracks) ? data.tracks : [];
}

async function prepareTrack(track) {
  if (track.url) return track;
  if (!track.streamProxyUrl) throw new Error("Нет stream URL");

  const endpoint = API_BASE
    ? `${API_BASE}${track.streamProxyUrl}`
    : track.streamProxyUrl;

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

function setPresence(name) {
  const map = loadJSON(storageKeys.presence, {});
  map[tabId] = { name, seenAt: Date.now() };
  saveJSON(storageKeys.presence, map);
  if (channel) channel.postMessage("update");
}

function cleanupPresence(map) {
  const now = Date.now();
  const cleaned = {};
  Object.entries(map).forEach(([id, item]) => {
    if (now - item.seenAt < 35000) cleaned[id] = item;
  });
  return cleaned;
}

function renderOnline() {
  const cleaned = cleanupPresence(loadJSON(storageKeys.presence, {}));
  saveJSON(storageKeys.presence, cleaned);

  const grouped = {};
  Object.values(cleaned).forEach((user) => {
    grouped[user.name] = (grouped[user.name] || 0) + 1;
  });

  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const totalTabs = Object.keys(cleaned).length;
  onlineCount.textContent = `Сейчас онлайн: ${totalTabs}`;
  onlineList.innerHTML = "";

  if (!entries.length) {
    const li = document.createElement("li");
    li.textContent = "Никого нет онлайн";
    onlineList.appendChild(li);
    return;
  }

  entries.forEach(([name, count]) => {
    const li = document.createElement("li");
    li.textContent = `${name} (${count})`;
    onlineList.appendChild(li);
  });
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
  return loadJSON(storageKeys.comments, []);
}

function saveComments(comments) {
  saveJSON(storageKeys.comments, comments.slice(0, 60));
}

function renderComments() {
  const comments = loadComments();
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

  searchStatus.textContent = "Ищу треки в SoundCloud...";

  try {
    const found = await findMusic(q);
    renderSearchResults(found);
    searchStatus.textContent = `Результатов: ${found.length}`;
  } catch {
    searchStatus.textContent = "Не удалось получить треки из SoundCloud API.";
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

commentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser?.username) {
    alert("Войдите в аккаунт");
    return;
  }

  const text = commentInput.value.trim();
  if (!text) return;

  const comments = loadComments();
  comments.unshift({
    author: currentUser.username,
    text,
    time: Date.now(),
  });
  saveComments(comments);
  commentInput.value = "";
  renderComments();
});

window.addEventListener("storage", (event) => {
  if (event.key === storageKeys.comments) {
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
  const map = loadJSON(storageKeys.presence, {});
  delete map[tabId];
  saveJSON(storageKeys.presence, map);
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
