// js/base.js (v5) - cleaned & fixed ES module exports, modal, TTS, BGM, listeners
// Firebase v11.6.1 CDN modules

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  getDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  setLogLevel,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Optional: Firestore debug log (disable in production if noisy)
setLogLevel("silent"); // "debug" | "error" | "silent"

// --- Global Constants and Configuration ---
const appId = "autonomy-helper-mock-id";
let app, db, auth, userId;
let renderCallback = () => {}; // current page renderer

const firebaseConfig = {
  apiKey: "AIzaSyDZ6A9haTwY6dCa93Tsa1X63ehzx-xe_FE",
  authDomain: "kidstest-99c7f.firebaseapp.com",
  projectId: "kidstest-99c7f",
  storageBucket: "kidstest-99c7f.firebasestorage.app",
  messagingSenderId: "4719977826",
  appId: "1:4719977826:web:e002e7b9b2036d3b39339e",
};

// --- Global State ---
export const state = {
  isAuthReady: false,
  currentView: null,
  kids: [],
  currentKidId: localStorage.getItem("currentKidId") || null,
  tasks: [],
  rewards: [],
  kidData: {}, // { kidId: { points, lastTaskCompletion, eggSlots, ... } }
};

// --- Firestore refs ---
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

// --- Default seed data ---
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
  if (!db) return;

  // Prevent repeated seeding (fast path)
  if (localStorage.getItem("seeded_v1") === "1") return;

  const [taskQuery, rewardQuery] = await Promise.all([
    getDocs(getTaskCollectionRef()),
    getDocs(getRewardCollectionRef()),
  ]);

  const batch = writeBatch(db);
  let hasNew = false;

  if (taskQuery.empty) {
    initialTasks.forEach((t) => batch.set(doc(getTaskCollectionRef()), t));
    hasNew = true;
  }
  if (rewardQuery.empty) {
    initialRewards.forEach((r) => batch.set(doc(getRewardCollectionRef()), r));
    hasNew = true;
  }

  if (hasNew) {
    await batch.commit();
    console.log("[Base] Default data initialized.");
  }
  localStorage.setItem("seeded_v1", "1");
}

// --- Toast ---
export function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;

  const bgColor =
    type === "success" ? "bg-success" : type === "danger" ? "bg-danger" : type === "info" ? "bg-secondary" : "bg-secondary";

  const toast = document.createElement("div");
  toast.className = `p-4 rounded-xl shadow-lg text-white font-semibold transition-all duration-300 transform translate-x-full ${bgColor}`;
  toast.innerHTML = message;

  toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.remove("translate-x-full"), 10);

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-x-full");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3000);
}

// --- Modal ---
export function closeModal() {
  const modalContainer = document.getElementById("modal-container");
  const modalContent = document.getElementById("modal-content");
  if (!modalContainer || !modalContent) return;

  modalContent.classList.add("scale-95", "opacity-0");
  modalContent.addEventListener(
    "transitionend",
    () => {
      modalContainer.classList.add("hidden");
      modalContent.innerHTML = "";
    },
    { once: true }
  );
}
window.closeModal = closeModal;

export function showModal(
  title,
  bodyHtml,
  confirmText = "確定",
  onConfirm = () => {},
  options = {}
) {
  const {
    cancelText = "取消",
    onCancel = () => closeModal(),
    showCancel = true,
  } = options;

  const modalContainer = document.getElementById("modal-container");
  const modalContent = document.getElementById("modal-content");
  if (!modalContainer || !modalContent) return;

  const cancelBtnHtml = showCancel
    ? `<button id="modal-cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition duration-150">${cancelText}</button>`
    : "";

  modalContent.innerHTML = `
    <h3 class="text-2xl font-bold text-primary mb-4 border-b pb-2">${title}</h3>
    <div class="modal-body mb-6 text-gray-700">${bodyHtml}</div>
    <div class="flex justify-end space-x-3">
      ${cancelBtnHtml}
      <button id="modal-confirm-btn" class="px-4 py-2 ${confirmText === "刪除" ? "bg-danger" : "bg-primary"} text-white font-semibold rounded-xl hover:opacity-80 transition duration-150">${confirmText}</button>
    </div>
  `;

  modalContainer.classList.remove("hidden");
  setTimeout(() => modalContent.classList.remove("scale-95", "opacity-0"), 10);

  const confirmBtn = document.getElementById("modal-confirm-btn");
  const cancelBtn = document.getElementById("modal-cancel-btn");

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      try { onCancel(); } finally { /* noop */ }
    };
  }

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      try { onConfirm(); } finally { /* noop */ }
    };
  }
}

// --- TTS ---
export function stopSpeaking() {
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  } catch {}
}

export function speakText(text, opts = {}) {
  try {
    if (!window.speechSynthesis || !text) return;
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = opts.lang || "zh-TW";
    u.rate = opts.rate ?? 0.95;
    u.pitch = opts.pitch ?? 1.05;
    u.volume = opts.volume ?? 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn("speakText error", e);
  }
}

// --- Kid switch ---
export const switchKid = (kidId) => {
  state.currentKidId = kidId;
  localStorage.setItem("currentKidId", kidId);
  const name = state.kids.find((k) => k.id === kidId)?.nickname || "小朋友";
  showToast(`已切換至 ${name}`, "info");
  // listeners will refresh UI
};
window.switchKid = switchKid;

// --- Background Music (BGM) ---
let _bgmAudio = null;

function _ensureBgmAudio() {
  if (_bgmAudio) return _bgmAudio;
  _bgmAudio = new Audio("assets/bgm/forest_magic.mp3");
  _bgmAudio.loop = true;
  _bgmAudio.volume = 0.28;
  return _bgmAudio;
}

export function isBgmEnabled() {
  return localStorage.getItem("bgmEnabled") === "1";
}

export function startBgm() {
  const a = _ensureBgmAudio();
  a.play().catch(() => {});
}

export function stopBgm() {
  if (_bgmAudio) _bgmAudio.pause();
}

export function setBgmEnabled(enabled) {
  localStorage.setItem("bgmEnabled", enabled ? "1" : "0");
  if (enabled) startBgm();
  else stopBgm();
  // Refresh header icon
  renderHeaderAndNavBar(state.currentView || "tasks");
}

function bindBgmAutoplayUnlock() {
  const unlock = () => {
    document.removeEventListener("pointerdown", unlock);
    if (isBgmEnabled()) startBgm();
  };
  document.addEventListener("pointerdown", unlock, { once: true });
}

// --- Header + Nav ---
function renderHeaderAndNavBar(currentView, kidNicknameFallback = "設定中...") {
  state.currentView = currentView;

  const currentKid = state.kids.find((k) => k.id === state.currentKidId);
  const kidName = currentKid?.nickname || kidNicknameFallback;
  const currentKidData = state.currentKidId ? state.kidData[state.currentKidId] || { points: 0 } : { points: 0 };

  const header = document.getElementById("kid-info");
  if (header) {
    header.innerHTML = `
      <div class="flex items-center space-x-3">
        <span class="text-xl font-bold text-primary">${kidName}</span>
        <button id="bgm-toggle" class="ml-2 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-sm" title="背景音樂">
          ${isBgmEnabled() ? "🎵" : "🔇"}
        </button>
      </div>
      <div class="flex items-center space-x-2 p-2 bg-secondary/20 rounded-full points-pulse">
        <span class="text-2xl font-extrabold text-secondary">${currentKidData.points || 0}</span>
        <span class="text-sm text-gray-800">點</span>
      </div>
    `;

    const bgmBtn = document.getElementById("bgm-toggle");
    if (bgmBtn) bgmBtn.onclick = () => setBgmEnabled(!isBgmEnabled());
  }

  const navBar = document.getElementById("nav-bar");
  if (navBar) {
    const navItems = [
      { name: "任務牆", view: "tasks", icon: "📝", link: "tasks.html" },
      { name: "精靈", view: "spirits", icon: "🥚", link: "spirits.html" },
      { name: "商店", view: "shop", icon: "🎁", link: "shop.html" },
      { name: "分數", view: "scores", icon: "📅", link: "scores.html" },
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

// --- Listeners ---
let _unsubscribers = [];

function clearListeners() {
  _unsubscribers.forEach((u) => {
    try { u(); } catch {}
  });
  _unsubscribers = [];
}

function setupListeners(pageViewName) {
  clearListeners();

  const updateUI = () => {
    const currentKid = state.kids.find((k) => k.id === state.currentKidId);
    renderHeaderAndNavBar(pageViewName, currentKid?.nickname || "設定中...");
    renderCallback();
  };

  const handleError = (error, name) => {
    console.error(`[Base] Listener failed (${name}):`, error);
    showToast(`數據讀取失敗 (${name})。請檢查網路或 Firestore 規則。`, "danger");
  };

  // Kids
  _unsubscribers.push(
    onSnapshot(
      getKidCollectionRef(),
      (snapshot) => {
        state.kids = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

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
      },
      (e) => handleError(e, "Kids")
    )
  );

  // Tasks (only needed on tasks/settings for speed; but safe to keep globally)
  _unsubscribers.push(
    onSnapshot(
      getTaskCollectionRef(),
      (snapshot) => {
        state.tasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        updateUI();
      },
      (e) => handleError(e, "Tasks")
    )
  );

  // Rewards
  _unsubscribers.push(
    onSnapshot(
      getRewardCollectionRef(),
      (snapshot) => {
        state.rewards = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        updateUI();
      },
      (e) => handleError(e, "Rewards")
    )
  );

  // Kid states
  _unsubscribers.push(
    onSnapshot(
      collection(getUserArtifactsRef(), "kid_states"),
      (snapshot) => {
        const next = {};
        snapshot.docs.forEach((d) => {
          next[d.id] = { id: d.id, ...d.data() };
        });
        state.kidData = next;
        updateUI();
      },
      (e) => handleError(e, "Kid States")
    )
  );
}

// --- initPage ---
export async function initPage(pageRenderFunc, pageViewName) {
  renderCallback = pageRenderFunc;
  state.currentView = pageViewName;

  const loadingScreen = document.getElementById("loading-screen");
  const content = document.getElementById("content");

  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Sign in anonymously (creates stable UID per browser unless storage cleared)
    await signInAnonymously(auth);

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.error("[Base] Firebase auth failed (user is null).");
        if (loadingScreen) loadingScreen.classList.add("hidden");
        if (content) {
          content.classList.remove("hidden");
          content.innerHTML = `
            <div class="text-center p-10 bg-danger/10 rounded-3xl mt-8 shadow-inner border border-danger">
              <p class="text-3xl font-bold text-danger mb-4">🚫 Firebase 連線失敗</p>
              <p class="text-gray-700 font-medium">請確認 Firebase 專案已啟用匿名登入 (Anonymous) 功能。</p>
            </div>`;
        }
        return;
      }

      userId = user.uid;
      state.isAuthReady = true;
      console.log(`[Base] Auth Success. User ID: ${userId}`);

      await preloadInitialData();

      setupListeners(pageViewName);
      bindBgmAutoplayUnlock();

      // First sync check (kids) to avoid blank screens
      const unsubscribeCheck = onSnapshot(
        getKidCollectionRef(),
        (snapshot) => {
          const hasKids = snapshot.size > 0;
          if (!hasKids && pageViewName !== "settings") {
            unsubscribeCheck();
            window.location.replace("settings.html");
            return;
          }

          if (loadingScreen) loadingScreen.classList.add("hidden");
          if (content) content.classList.remove("hidden");
          unsubscribeCheck();
        },
        (error) => {
          console.error("[Base] Initial kids sync failed:", error);
          unsubscribeCheck();
          if (loadingScreen) loadingScreen.classList.add("hidden");
          if (content) {
            content.classList.remove("hidden");
            content.innerHTML = `<p class="text-xl font-bold text-danger">數據同步失敗，請檢查 Firestore 規則。</p>`;
          }
        }
      );
    });
  } catch (error) {
    console.error("App Initialization Fatal Error:", error);
    if (loadingScreen) loadingScreen.classList.add("hidden");
    if (content) {
      content.classList.remove("hidden");
      content.innerHTML = `
        <div class="text-center p-8 bg-danger/10 rounded-xl shadow-lg mt-8">
          <p class="text-xl font-bold text-danger">應用程式初始化失敗</p>
          <p class="mt-2 text-sm text-gray-700">錯誤訊息: ${error?.message || error}</p>
        </div>`;
    }
  }
}

// Export common Firestore helpers ONCE (avoid duplicate export errors)
export { getFirestore, getDoc, getDocs, writeBatch, arrayUnion, doc, collection, setDoc };
