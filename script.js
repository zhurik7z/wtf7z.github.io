const tracks = [
  {
    title: "Dream Pulse",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    title: "Night Drive",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    title: "Skyline",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
];

const notifications = [
  "Добро пожаловать на сайт wtf7z",
  "Проверь новые проекты в блоке информации",
  "Оставь комментарий под профилем",
];

const authStorageKey = "wtf7z-auth";
const commentStorageKey = "wtf7z-comments";

const audio = document.getElementById("audio");
const playlist = document.getElementById("playlist");
const notifyBtn = document.getElementById("notifyBtn");
const notifyPanel = document.getElementById("notifyPanel");
const notifyList = document.getElementById("notifyList");
const notifyDot = document.getElementById("notifyDot");

const loginForm = document.getElementById("loginForm");
const loginInput = document.getElementById("loginInput");
const passwordInput = document.getElementById("passwordInput");
const authStatus = document.getElementById("authStatus");
const logoutBtn = document.getElementById("logoutBtn");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentList = document.getElementById("commentList");

let currentTrack = 0;
let isAuthed = localStorage.getItem(authStorageKey) === "true";

function setTrack(index) {
  currentTrack = index;
  audio.src = tracks[index].url;
  [...playlist.querySelectorAll("button")].forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });
}

function buildPlaylist() {
  tracks.forEach((track, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${track.title}`;
    button.addEventListener("click", () => {
      setTrack(index);
      audio.play();
    });
    li.appendChild(button);
    playlist.appendChild(li);
  });
  setTrack(0);
}

function buildNotifications() {
  notifications.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    notifyList.appendChild(li);
  });
}

function renderAuth() {
  authStatus.textContent = isAuthed ? "Авторизован" : "Не авторизован";
  loginForm.classList.toggle("hidden", isAuthed);
  logoutBtn.classList.toggle("hidden", !isAuthed);
  commentForm.classList.toggle("hidden", !isAuthed);
}

function saveComments(comments) {
  localStorage.setItem(commentStorageKey, JSON.stringify(comments));
}

function loadComments() {
  const raw = localStorage.getItem(commentStorageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderComments() {
  const comments = loadComments();
  commentList.innerHTML = "";

  if (comments.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Пока комментариев нет.";
    commentList.appendChild(empty);
    return;
  }

  comments.forEach((comment) => {
    const li = document.createElement("li");
    li.textContent = comment;
    commentList.appendChild(li);
  });
}

audio.addEventListener("ended", () => {
  const next = (currentTrack + 1) % tracks.length;
  setTrack(next);
  audio.play();
});

notifyBtn.addEventListener("click", () => {
  notifyPanel.classList.toggle("hidden");
  notifyDot.classList.add("hidden");
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const login = loginInput.value.trim();
  const password = passwordInput.value.trim();

  if (login === "wtf7z" && password === "123456") {
    isAuthed = true;
    localStorage.setItem(authStorageKey, "true");
    renderAuth();
    alert("Вход выполнен");
    return;
  }

  alert("Неверный логин или пароль");
});

logoutBtn.addEventListener("click", () => {
  isAuthed = false;
  localStorage.removeItem(authStorageKey);
  renderAuth();
});

commentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = commentInput.value.trim();
  if (!text) return;

  const comments = loadComments();
  comments.unshift(text);
  saveComments(comments.slice(0, 30));
  commentInput.value = "";
  renderComments();
});

buildPlaylist();
buildNotifications();
renderAuth();
renderComments();
