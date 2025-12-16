// js/base.js (v3)
// Shared Firebase + UI state + helpers for KIDSTEST
// Fixes in v3:
// - Faster loading: only subscribe to collections needed per page
// - Add Scores nav link + page
// - Fix switch kid header updating reliably (force UI refresh)
// - Add background BGM (WebAudio synth) with toggle button in header (requires user gesture)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  getDocs,
  writeBatch,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = "autonomy-helper-mock-id";
let app, db, auth, userId;
let renderCallback = () => {};

const firebaseConfig = {
  apiKey: "AIzaSyDZ6A9haTwY6dCa93Tsa1X63ehzx-xe_FE",
  authDomain: "kidstest-99c7f.firebaseapp.com",
  projectId: "kidstest-99c7f",
  storageBucket: "kidstest-99c7f.firebasestorage.app",
  messagingSenderId: "4719977826",
  appId: "1:4719977826:web:e002e7b9b2036d3b39339e",
};

export const state = {
  isAuthReady: false,
  kids: [],
  currentKidId: localStorage.getItem("currentKidId") || null,
  tasks: [],
  rewards: [],
  kidData: {},
  isSpeaking: false,
  bgmEnabled: localStorage.getItem("bgmEnabled") === "1",
};

// ---------- Firestore refs ----------
function getUserArtifactsRef() {
  if (!userId) throw new Error("User not authenticated.");
  return doc(db, "artifacts", appId, "users", userId);
}
export function getKidCollectionRef() {
  return collection(getUserArtifactsRef(), "kids");
}
export function getTaskCollectionRef() {
  return collection(getUserArtifactsRef(), "tasks");
}
export function getRewardCollectionRef() {
  return collection(getUserArtifactsRef(), "rewards");
}
export function getKidStateDocRef(kidId) {
  return doc(getUserArtifactsRef(), "kid_states", kidId);
}
// Legacy name used by other pages
export const getKidDocRef = getKidStateDocRef;

// ---------- Seed default data (one-time with localStorage flag) ----------
const initialTasks = [
  { name: "準時上床", description: "晚上 9 點前刷牙換睡衣並躺在床上。", points: 10, cycle: "daily" },
  { name: "整理玩具", description: "自己將玩完的玩具物歸原位。", points: 15, cycle: "daily" },
  { name: "協助家務", description: "幫忙把洗好的衣服拿到房間放好。", points: 30, cycle: "once" },
  { name: "閱讀時光", description: "每天至少閱讀一本書 15 分鐘。", points: 10, cycle: "daily" },
  { name: "禮貌表達", description: "對長輩說「請、謝謝、對不起」。", points: 5, cycle: "daily" },
];
const initialRewards = [
  { name: "週末甜點", description: "換取一次晚餐後的冰淇淋或小蛋糕。", cost: 150 },
  { name: "多玩 30 分鐘", description: "換取額外 30 分鐘看電視或玩遊戲時間。", cost: 200 },
  { name: "玩具購物券", description: "可兌換一張 100 元的玩具購物券。", cost: 500 },
  { name: "睡前故事", description: "讓爸爸/媽媽多講一個睡前故事。", cost: 80 },
  { name: "戶外活動", description: "週末全家去公園或郊遊一次。", cost: 400 },
];

async function preloadInitialData() {
  const seeded = localStorage.getItem("seeded_v1") === "1";
  if (seeded) return;

  const taskQuery = await getDocs(getTaskCollectionRef());
  const rewardQuery = await getDocs(getRewardCollectionRef());
  if (!taskQuery.empty && !rewardQuery.empty) {
    localStorage.setItem("seeded_v1", "1");
    return;
  }

  const batch = writeBatch(db);
  let hasNewData = false;
  if (taskQuery.empty) {
    initialTasks.forEach((t) => batch.set(doc(getTaskCollectionRef()), t));
    hasNewData = true;
  }
  if (rewardQuery.empty) {
    initialRewards.forEach((r) => batch.set(doc(getRewardCollectionRef()), r));
    hasNewData = true;
  }
  if (hasNewData) await batch.commit();
  localStorage.setItem("seeded_v1", "1");
}

// ---------- Toast / Modal ----------
export function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;

  const bg =
    type === "success" ? "bg-success" : type === "danger" ? "bg-danger" : "bg-secondary";

  const toast = document.createElement("div");
  toast.className = `p-4 rounded-xl shadow-lg text-white font-semibold transition-all duration-300 transform translate-x-full ${bg}`;
  toast.innerHTML = message;
  toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.remove("translate-x-full"), 10);
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-x-full");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3000);
}

export function closeModal() {
  const modalContainer = document.getElementById("modal-container");
  const modalContent = document.getElementById("modal-content");
  if (!modalContainer || !modalContent) return;

  modalContent.classList.add("scale-95", "opacity-0");
  modalContent.addEventListener(
    "transitionend",
    () => modalContainer.classList.add("hidden"),
    { once: true }
  );
  stopSpeaking();
}
window.closeModal = closeModal;

export function showModal(title, bodyHtml, confirmText = "確定", onConfirm = async () => {}) {
  const modalContainer = document.getElementById("modal-container");
  const modalContent = document.getElementById("modal-content");
  if (!modalContainer || !modalContent) return;

  const isDelete = confirmText === "刪除";
  const confirmBtnClass = isDelete ? "bg-danger" : "bg-primary";

  modalContent.innerHTML = `
    <h3 class="text-2xl font-bold text-primary mb-4 border-b pb-2">${title}</h3>
    <div class="modal-body mb-6 text-gray-700">${bodyHtml}</div>
    <div class="flex justify-end space-x-3">
      <button type="button" id="modal-cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition duration-150">取消</button>
      <button type="button" id="modal-confirm-btn" class="px-4 py-2 ${confirmBtnClass} text-white font-semibold rounded-xl hover:opacity-80 transition duration-150">${confirmText}</button>
    </div>
  `;

  modalContainer.classList.remove("hidden");
  setTimeout(() => modalContent.classList.remove("scale-95", "opacity-0"), 10);

  document.getElementById("modal-cancel-btn")?.addEventListener("click", () => closeModal(), { once: true });
  const confirmBtn = document.getElementById("modal-confirm-btn");
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      try {
        await onConfirm();
      } catch (e) {
        // let caller show toast
        console.error(e);
      }
    };
  }
}

// ---------- TTS ----------
export function stopSpeaking() {
  if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  state.isSpeaking = false;
  forceUIRefresh();
}

export function speakText(text) {
  stopSpeaking();
  if (!("speechSynthesis" in window)) {
    showToast("您的瀏覽器不支持語音朗讀功能！", "danger");
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const zh = voices.find((v) => v.lang && v.lang.startsWith("zh-"));
  if (zh) u.voice = zh;
  u.lang = zh?.lang || "zh-TW";
  u.rate = 1.0;
  u.pitch = 1.0;

  u.onstart = () => {
    state.isSpeaking = true;
    forceUIRefresh();
  };
  u.onend = () => {
    state.isSpeaking = false;
    forceUIRefresh();
  };
  u.onerror = () => {
    state.isSpeaking = false;
    forceUIRefresh();
  };
  window.speechSynthesis.speak(u);
}

// ---------- Background BGM (WebAudio synth) ----------
let bgmCtx = null;
let bgmNodes = null;

function ensureAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!bgmCtx) bgmCtx = new AudioCtx();
  if (bgmCtx.state === "suspended") bgmCtx.resume().catch(() => {});
  return bgmCtx;
}

function startBgm() {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  if (bgmNodes) return; // already playing

  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.setValueAtTime(220, ctx.currentTime);

  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.25, ctx.currentTime);
  lfoGain.gain.setValueAtTime(18, ctx.currentTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, ctx.currentTime);

  gain.gain.setValueAtTime(0.0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.3);

  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  lfo.start();

  // simple slow chord movement by stepping frequency
  let step = 0;
  const notes = [220, 246.94, 196, 261.63]; // A3, B3, G3, C4
  const timer = setInterval(() => {
    if (!bgmNodes) return;
    step = (step + 1) % notes.length;
    osc.frequency.setTargetAtTime(notes[step], ctx.currentTime, 0.4);
  }, 4000);

  bgmNodes = { osc, lfo, lfoGain, gain, filter, timer };
}

function stopBgm() {
  if (!bgmNodes) return;
  try {
    const ctx = bgmCtx;
    const t = ctx.currentTime;
    bgmNodes.gain.gain.cancelScheduledValues(t);
    bgmNodes.gain.gain.setTargetAtTime(0.0001, t, 0.15);
    setTimeout(() => {
      try { bgmNodes.osc.stop(); } catch {}
      try { bgmNodes.lfo.stop(); } catch {}
      clearInterval(bgmNodes.timer);
      bgmNodes = null;
    }, 400);
  } catch {
    clearInterval(bgmNodes.timer);
    bgmNodes = null;
  }
}

export function toggleBgm() {
  state.bgmEnabled = !state.bgmEnabled;
  localStorage.setItem("bgmEnabled", state.bgmEnabled ? "1" : "0");
  if (state.bgmEnabled) startBgm();
  else stopBgm();
  forceUIRefresh();
}

function maybeAutoStartBgm() {
  // autoplay is blocked: we can only start after a gesture
  if (!state.bgmEnabled) return;
  const handler = () => {
    startBgm();
    window.removeEventListener("pointerdown", handler);
  };
  window.addEventListener("pointerdown", handler, { once: true });
}

// ---------- UI Header / Nav ----------
function renderHeaderAndNavBar(currentView, fallbackKidNickname = "設定中...") {
  const currentKid = state.kids.find((k) => k.id === state.currentKidId);
  const currentKidData = state.kidData[state.currentKidId] || { points: 0 };

  const header = document.getElementById("kid-info");
  if (header) {
    header.innerHTML = `
      <div class="flex items-center space-x-3 min-w-0">
        <span class="text-xl font-bold text-primary truncate">${currentKid ? currentKid.nickname : fallbackKidNickname}</span>
        <button onclick="window.toggleBgm()" class="text-xl" title="背景音樂">${state.bgmEnabled ? "🎵" : "🔇"}</button>
      </div>
      <div class="flex items-center space-x-2 p-2 bg-secondary/20 rounded-full points-pulse">
        <span class="text-2xl font-extrabold text-secondary">${currentKidData.points || 0}</span>
        <span class="text-sm text-gray-800">點</span>
      </div>
    `;
  }

  const navBar = document.getElementById("nav-bar");
  if (navBar) {
    const navItems = [
      { name: "任務牆", view: "tasks", icon: "📝", link: "tasks.html" },
      { name: "每日分數", view: "scores", icon: "📅", link: "scores.html" },
      { name: "精靈", view: "spirits", icon: "🥚", link: "spirits.html" },
      { name: "商店", view: "shop", icon: "🎁", link: "shop.html" },
      { name: "設定", view: "settings", icon: "⚙️", link: "settings.html" },
    ];

    navBar.innerHTML = navItems
      .map(
        (item) => `
        <a href="${item.link}" class="flex flex-col items-center justify-center p-2 flex-1 transition-colors
          ${currentView === item.view ? "text-primary font-bold bg-gray-100 rounded-lg" : "text-gray-400 hover:text-gray-600"}">
          <span class="text-2xl">${item.icon}</span>
          <span class="text-xs font-medium mt-1">${item.name}</span>
        </a>
      `
      )
      .join("");
  }
}

function forceUIRefresh() {
  // Ensure header/nav and the page render callback run after state changes (kid switch, speech, bgm)
  try {
    // no-op
  } finally {
    if (renderCallback) renderCallback();
  }
}

// ---------- Kid switch ----------
export const switchKid = (kidId) => {
  state.currentKidId = kidId;
  localStorage.setItem("currentKidId", kidId);
  showToast(`已切換至 ${state.kids.find((k) => k.id === kidId)?.nickname || "小朋友"}`, "info");
  stopSpeaking();
  forceUIRefresh();
};
window.switchKid = switchKid;
window.toggleBgm = toggleBgm;

// ---------- Listeners (only what's needed) ----------
function setupListeners(pageViewName) {
  const needs = {
    kids: true,
    kidStates: true,
    tasks: pageViewName === "tasks" || pageViewName === "settings",
    rewards: pageViewName === "settings" || pageViewName === "shop",
  };

  const updateUI = () => {
    const currentKid = state.kids.find((k) => k.id === state.currentKidId);
    renderHeaderAndNavBar(pageViewName, currentKid?.nickname || "設定中...");
    forceUIRefresh();
  };

  onSnapshot(getKidCollectionRef(), (snap) => {
    state.kids = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (state.kids.length > 0) {
      if (!state.currentKidId || !state.kids.some((k) => k.id === state.currentKidId)) {
        state.currentKidId = state.kids[0].id;
        localStorage.setItem("currentKidId", state.currentKidId);
      }
    } else {
      state.currentKidId = null;
      localStorage.removeItem("currentKidId");
    }
    updateUI();
  });

  if (needs.tasks) {
    onSnapshot(getTaskCollectionRef(), (snap) => {
      state.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateUI();
    });
  }

  if (needs.rewards) {
    onSnapshot(getRewardCollectionRef(), (snap) => {
      state.rewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateUI();
    });
  }

  if (needs.kidStates) {
    const kidStatesRef = collection(getUserArtifactsRef(), "kid_states");
    onSnapshot(kidStatesRef, (snap) => {
      state.kidData = {};
      snap.docs.forEach((d) => {
        state.kidData[d.id] = { id: d.id, ...d.data() };
      });
      updateUI();
    });
  }
}

// ---------- init ----------
export function initPage(pageRenderFunc, pageViewName) {
  renderCallback = pageRenderFunc;

  const loadingScreen = document.getElementById("loading-screen");
  const content = document.getElementById("content");

  (async () => {
    try {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);

      await signInAnonymously(auth);

      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          if (loadingScreen) loadingScreen.classList.add("hidden");
          if (content) {
            content.classList.remove("hidden");
            content.innerHTML = `<div class="text-center p-10 bg-danger/10 rounded-3xl mt-8 shadow-inner border border-danger">
              <p class="text-3xl font-bold text-danger mb-4">🚫 Firebase 連線失敗</p>
              <p class="text-gray-700 font-medium">請確認 Firebase 已啟用匿名登入 (Anonymous)。</p>
            </div>`;
          }
          return;
        }

        userId = user.uid;
        state.isAuthReady = true;

        await preloadInitialData();
        setupListeners(pageViewName);
        maybeAutoStartBgm();

        // If no kids, redirect to settings (except settings page)
        const unsub = onSnapshot(getKidCollectionRef(), (snap) => {
          const hasKids = snap.size > 0;
          if (!hasKids && pageViewName !== "settings") {
            unsub();
            window.location.replace("settings.html");
            return;
          }
          if (loadingScreen) loadingScreen.classList.add("hidden");
          if (content) content.classList.remove("hidden");
          unsub();
        });
      });
    } catch (error) {
      console.error("[Base] Fatal init error:", error);
      if (loadingScreen) loadingScreen.classList.add("hidden");
      if (content) {
        content.classList.remove("hidden");
        content.innerHTML = `<div class="text-center p-8 bg-danger/10 rounded-xl shadow-lg mt-8">
          <p class="text-xl font-bold text-danger">應用程式初始化失敗</p>
          <p class="mt-2 text-sm text-gray-700">錯誤訊息: ${error.message}</p>
        </div>`;
      }
    }
  })();
}

// Re-export some Firestore helpers used by other files
export { setDoc, writeBatch, arrayUnion, getDocs, doc, collection };