// js/base.js (v6)
// IMPORTANT:
// This file is an ES Module (contains `export`). It MUST be loaded via `import` from a page module
// (e.g. tasks.js / settings.js / spirits.js / shop.js) OR via <script type="module">.
// Recommended: In each HTML, ONLY load the page entry script, e.g.
//   <script type="module" src="js/tasks.js"></script>
// Do NOT also load base.js in HTML, because tasks.js already imports it.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc as fsSetDoc,
  onSnapshot,
  collection,
  getDoc as fsGetDoc,
  getDocs as fsGetDocs,
  writeBatch,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// -------------------- Firebase config --------------------
const firebaseConfig = {
  apiKey: "AIzaSyDZ6A9haTwY6dCa93Tsa1X63ehzx-xe_FE",
  authDomain: "kidstest-99c7f.firebaseapp.com",
  projectId: "kidstest-99c7f",
  storageBucket: "kidstest-99c7f.firebasestorage.app",
  messagingSenderId: "4719977826",
  appId: "1:4719977826:web:e002e7b9b2036d3b39339e",
};

const appId = "autonomy-helper-mock-id";

let app = null;
let db = null;
let auth = null;
let userId = null;

// -------------------- Global state --------------------
export const state = {
  isAuthReady: false,
  currentView: null,

  kids: [],
  currentKidId: localStorage.getItem("currentKidId") || null,

  tasks: [],
  rewards: [],

  kidData: {}, // { kidId: { points, lastTaskCompletion, eggSlots, ... } }
};

// -------------------- Firestore refs --------------------
function getUserRootDoc() {
  if (!db) throw new Error("Firestore not initialized.");
  if (!userId) throw new Error("User not authenticated.");
  return doc(db, "artifacts", appId, "users", userId);
}

export function getKidCollectionRef() {
  return collection(getUserRootDoc(), "kids");
}
export function getTaskCollectionRef() {
  return collection(getUserRootDoc(), "tasks");
}
export function getRewardCollectionRef() {
  return collection(getUserRootDoc(), "rewards");
}
export function getKidStateDocRef(kidId) {
  return doc(getUserRootDoc(), "kid_states", kidId);
}

// -------------------- Seed default data (once) --------------------
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

async function preloadInitialDataOnce() {
  if (!db) return;
  if (localStorage.getItem("seeded_v2") === "1") return;

  const [tSnap, rSnap] = await Promise.all([
    fsGetDocs(getTaskCollectionRef()),
    fsGetDocs(getRewardCollectionRef()),
  ]);

  const batch = writeBatch(db);
  let changed = false;

  if (tSnap.empty) {
    initialTasks.forEach((t) => batch.set(doc(getTaskCollectionRef()), t));
    changed = true;
  }
  if (rSnap.empty) {
    initialRewards.forEach((r) => batch.set(doc(getRewardCollectionRef()), r));
    changed = true;
  }

  if (changed) await batch.commit();
  localStorage.setItem("seeded_v2", "1");
}

// -------------------- Toast --------------------
export function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;

  const bgColor =
    type === "success" ? "bg-success" :
    type === "danger" ? "bg-danger" :
    type === "info" ? "bg-secondary" :
    "bg-secondary";

  const toast = document.createElement("div");
  toast.className = `p-4 rounded-xl shadow-lg text-white font-semibold transition-all duration-300 transform translate-x-full ${bgColor}`;
  toast.innerHTML = message;

  toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.remove("translate-x-full"), 10);
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-x-full");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 2600);
}

// -------------------- Modal --------------------
export function closeModal() {
  const modalContainer = document.getElementById("modal-container");
  const modalContent = document.getElementById("modal-content");
  if (!modalContainer || !modalContent) return;

  modalContent.classList.add("scale-95", "opacity-0");
  modalContent.addEventListener("transitionend", () => {
    modalContainer.classList.add("hidden");
    modalContent.innerHTML = "";
  }, { once: true });
}
window.closeModal = closeModal;

export function showModal(title, bodyHtml, confirmText = "確定", onConfirm = () => {}, options = {}) {
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

  if (cancelBtn) cancelBtn.onclick = () => onCancel();
  if (confirmBtn) confirmBtn.onclick = () => onConfirm();
}

// -------------------- TTS --------------------
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
  } catch {}
}

// -------------------- BGM --------------------
let _bgm = null;

function ensureBgm() {
  if (_bgm) return _bgm;
  _bgm = new Audio("assets/bgm/forest_magic.mp3");
  _bgm.loop = true;
  _bgm.volume = 0.28;
  return _bgm;
}

export function isBgmEnabled() {
  return localStorage.getItem("bgmEnabled") === "1";
}

export function setBgmEnabled(enabled) {
  localStorage.setItem("bgmEnabled", enabled ? "1" : "0");
  if (enabled) startBgm(); else stopBgm();
  renderHeaderAndNavBar(state.currentView || "tasks");
}

export function startBgm() {
  const a = ensureBgm();
  a.play().catch(() => {});
}
export function stopBgm() {
  if (_bgm) _bgm.pause();
}

function bindBgmAutoplayUnlockOnce() {
  const unlock = () => {
    document.removeEventListener("pointerdown", unlock);
    if (isBgmEnabled()) startBgm();
  };
  document.addEventListener("pointerdown", unlock, { once: true });
}

// -------------------- Kid switch --------------------
export function switchKid(kidId) {
  state.currentKidId = kidId;
  localStorage.setItem("currentKidId", kidId);
  const name = state.kids.find((k) => k.id === kidId)?.nickname || "小朋友";
  showToast(`已切換至 ${name}`, "info");
}
window.switchKid = switchKid;

// -------------------- Header + Nav --------------------
function renderHeaderAndNavBar(currentView, fallbackKidName = "設定中...") {
  state.currentView = currentView;

  const currentKid = state.kids.find((k) => k.id === state.currentKidId);
  const kidName = currentKid?.nickname || fallbackKidName;
  const kidData = state.currentKidId ? (state.kidData[state.currentKidId] || { points: 0 }) : { points: 0 };

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
        <span class="text-2xl font-extrabold text-secondary">${kidData.points || 0}</span>
        <span class="text-sm text-gray-800">點</span>
      </div>
    `;

    const btn = document.getElementById("bgm-toggle");
    if (btn) btn.onclick = () => setBgmEnabled(!isBgmEnabled());
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

    navBar.innerHTML = navItems.map((item) => `
      <a href="${item.link}" class="flex flex-col items-center justify-center p-2 flex-1 transition-colors
        ${currentView === item.view ? "text-primary font-bold bg-gray-100 rounded-lg" : "text-gray-400 hover:text-gray-600"}">
        <span class="text-2xl">${item.icon}</span>
        <span class="text-xs font-medium mt-1">${item.name}</span>
      </a>
    `).join("");
  }
}

// -------------------- Firestore helpers you can import --------------------
export async function setDoc(ref, data, options = {}) {
  // wrapper for firebase setDoc (keeps your existing imports working)
  return fsSetDoc(ref, data, options);
}
export async function getDoc(ref) {
  return fsGetDoc(ref);
}
export async function getDocs(query) {
  return fsGetDocs(query);
}

// -------------------- Real-time listeners (per page) --------------------
let _unsubs = [];
function clearListeners() {
  _unsubs.forEach((u) => { try { u(); } catch {} });
  _unsubs = [];
}

function setupListeners(pageViewName, renderFn) {
  clearListeners();

  const updateUI = () => {
    renderHeaderAndNavBar(pageViewName);
    try { renderFn(); } catch (e) { console.error(e); }
  };

  const onErr = (name) => (e) => {
    console.error(`[Base] Listener failed (${name}):`, e);
    showToast(`讀取失敗：${name}`, "danger");
  };

  _unsubs.push(onSnapshot(getKidCollectionRef(), (snap) => {
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
  }, onErr("Kids")));

  // Keep tasks & rewards synced (simple + stable)
  _unsubs.push(onSnapshot(getTaskCollectionRef(), (snap) => {
    state.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    updateUI();
  }, onErr("Tasks")));

  _unsubs.push(onSnapshot(getRewardCollectionRef(), (snap) => {
    state.rewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    updateUI();
  }, onErr("Rewards")));

  _unsubs.push(onSnapshot(collection(getUserRootDoc(), "kid_states"), (snap) => {
    const next = {};
    snap.docs.forEach((d) => { next[d.id] = { id: d.id, ...d.data() }; });
    state.kidData = next;
    updateUI();
  }, onErr("Kid States")));
}

// -------------------- initPage --------------------
export async function initPage(pageRenderFunc, pageViewName) {
  state.currentView = pageViewName;

  const loadingScreen = document.getElementById("loading-screen");
  const content = document.getElementById("content");

  const showContent = () => {
    if (loadingScreen) loadingScreen.classList.add("hidden");
    if (content) content.classList.remove("hidden");
  };

  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Anonymous auth (stable until browser data cleared)
    await signInAnonymously(auth);

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        showContent();
        if (content) content.innerHTML = "<p class='p-6 bg-danger/10 rounded-2xl text-danger font-bold'>Firebase 登入失敗（user=null）</p>";
        return;
      }

      userId = user.uid;
      state.isAuthReady = true;

      await preloadInitialDataOnce();

      setupListeners(pageViewName, pageRenderFunc);
      bindBgmAutoplayUnlockOnce();

      // If no kids and not on settings page, redirect
      const unsubOnce = onSnapshot(getKidCollectionRef(), (snap) => {
        if (snap.size === 0 && pageViewName !== "settings") {
          unsubOnce();
          window.location.replace("settings.html");
          return;
        }
        showContent();
        unsubOnce();
      }, () => {
        showContent();
        if (content) content.innerHTML = "<p class='p-6 bg-danger/10 rounded-2xl text-danger font-bold'>資料同步失敗，請檢查 Firestore 規則</p>";
        unsubOnce();
      });
    });
  } catch (e) {
    console.error(e);
    showContent();
    if (content) content.innerHTML = `<p class="p-6 bg-danger/10 rounded-2xl text-danger font-bold">初始化失敗：${e?.message || e}</p>`;
  }
}
