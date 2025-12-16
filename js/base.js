// js/base.js (final cohesive version)
// Goals:
// - Stable ES module exports
// - Anonymous auth + Firestore listeners
// - Seed default tasks & rewards if empty
// - Multi-kid support with switchKid()
// - Header/nav render (includes Scores link)
// - Background music controls
// - Speech helpers (speakText/stopSpeaking)
// - Debounced render to avoid "render storms"

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  setDoc as fsSetDoc,
  getDocs,
  writeBatch,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* =====================
   Firebase config
===================== */
const firebaseConfig = {
  apiKey: "AIzaSyDZ6A9haTwY6dCa93Tsa1X63ehzx-xe_FE",
  authDomain: "kidstest-99c7f.firebaseapp.com",
  projectId: "kidstest-99c7f",
  storageBucket: "kidstest-99c7f.firebasestorage.app",
  messagingSenderId: "4719977826",
  appId: "1:4719977826:web:e002e7b9b2036d3b39339e",
};

const appId = "autonomy-helper-mock-id";

let app, db, auth, userId;

/* =====================
   Global state
===================== */
export const state = {
  isAuthReady: false,
  currentView: null,
  kids: [],
  currentKidId: localStorage.getItem("currentKidId") || null,
  tasks: [],
  rewards: [],
  kidData: {}, // kid_states map by kidId
};

/* =====================
   Firestore refs
===================== */
function getUserRootDoc() {
  if (!db || !userId) throw new Error("Firestore not ready");
  return doc(db, "artifacts", appId, "users", userId);
}

export function getKidCollectionRef() {
  return collection(getUserRootDoc(), "kids");
}
export function getKidDocRef(kidId) {
  return doc(getUserRootDoc(), "kids", kidId);
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

/* =====================
   UI: Toast
===================== */
export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const div = document.createElement("div");
  div.className =
    "p-4 mb-2 rounded-xl text-white shadow transition " +
    (type === "danger" ? "bg-red-500" : type === "info" ? "bg-sky-500" : "bg-green-600");
  div.innerText = message;
  container.appendChild(div);
  setTimeout(() => div.remove(), 2600);
}

/* =====================
   UI: Modal
===================== */
export function closeModal() {
  const m = document.getElementById("modal-container");
  const c = document.getElementById("modal-content");
  if (!m || !c) return;
  m.classList.add("hidden");
  c.innerHTML = "";
}
window.closeModal = closeModal;

export function showModal(title, bodyHtml, confirmText = "OK", onConfirm = () => closeModal()) {
  const m = document.getElementById("modal-container");
  const c = document.getElementById("modal-content");
  if (!m || !c) return;

  c.innerHTML = `
    <h3 class="text-xl font-black mb-4">${title}</h3>
    <div class="mb-6">${bodyHtml}</div>
    <div class="flex justify-end gap-3">
      <button id="modal-cancel" class="px-4 py-2 bg-gray-200 rounded-xl">關閉</button>
      <button id="modal-ok" class="px-4 py-2 bg-primary text-white rounded-xl">${confirmText}</button>
    </div>
  `;
  m.classList.remove("hidden");
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("modal-ok").onclick = onConfirm;
}

/* =====================
   Speech
===================== */
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
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.volume = opts.volume ?? 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

/* =====================
   Background Music (BGM)
===================== */
let bgm;
const BGM_KEY = "bgm_enabled";
export function startBgm() {
  try {
    const enabled = localStorage.getItem(BGM_KEY);
    if (enabled === "0") return;
    if (!bgm) {
      bgm = new Audio("assets/bgm/forest_magic.mp3");
      bgm.loop = true;
      bgm.volume = 0.25;
    }
    bgm.play().catch(() => {});
  } catch {}
}
export function stopBgm() {
  try {
    if (bgm) bgm.pause();
  } catch {}
}
export function toggleBgm() {
  const enabled = localStorage.getItem(BGM_KEY) !== "0";
  if (enabled) {
    localStorage.setItem(BGM_KEY, "0");
    stopBgm();
    showToast("已關閉背景音樂", "info");
  } else {
    localStorage.setItem(BGM_KEY, "1");
    startBgm();
    showToast("已開啟背景音樂", "success");
  }
}

/* =====================
   Header / Nav
===================== */
function renderHeader() {
  const header = document.getElementById("kid-info");
  if (!header) return;

  const kid = state.kids.find((k) => k.id === state.currentKidId);
  const data = state.kidData[state.currentKidId] || { points: 0 };

  header.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="font-black text-gray-800 truncate">${kid?.nickname || "請到設定新增小朋友"}</div>
        <div class="text-xs text-gray-500">點數累積不會扣除（可孵蛋 / 可換獎勵）</div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <div class="bg-secondary/20 text-secondary px-3 py-1 rounded-full font-black">🪙 ${Number(data.points || 0)}</div>
        <button id="bgm-btn" class="bg-gray-200 px-3 py-1 rounded-full text-sm font-bold">🎵</button>
      </div>
    </div>
  `;

  const btn = document.getElementById("bgm-btn");
  if (btn) btn.onclick = toggleBgm;
}

function renderNav() {
  const nav = document.getElementById("nav-bar");
  if (!nav) return;

  nav.innerHTML = `
    <a href="tasks.html" title="任務">📝</a>
    <a href="scores.html" title="分數">📅</a>
    <a href="spirits.html" title="精靈">🥚</a>
    <a href="shop.html" title="獎勵">🎁</a>
    <a href="settings.html" title="設定">⚙️</a>
  `;
}

/* =====================
   switchKid
===================== */
export function switchKid(kidId) {
  if (!kidId) return;
  state.currentKidId = kidId;
  localStorage.setItem("currentKidId", kidId);
  renderHeader();
  if (typeof window.__rerenderCurrentView === "function") {
    window.__rerenderCurrentView();
  }
}

/* =====================
   Firestore helpers
===================== */
export async function setDoc(ref, data, options = { merge: true }) {
  return fsSetDoc(ref, data, options);
}
export async function addDocument(colRef, data) {
  return addDoc(colRef, data);
}

/* =====================
   Seed default tasks & rewards
===================== */
async function ensureDefaultData() {
  const tasksRef = getTaskCollectionRef();
  const rewardsRef = getRewardCollectionRef();

  const [tasksSnap, rewardsSnap] = await Promise.all([getDocs(tasksRef), getDocs(rewardsRef)]);
  if (!tasksSnap.empty && !rewardsSnap.empty) return;

  const batch = writeBatch(db);

  if (tasksSnap.empty) {
    const defaultTasks = [
      { name: "整理玩具", description: "把玩具收回原位", points: 10, cycle: "daily" },
      { name: "刷牙洗臉", description: "早晚刷牙洗臉", points: 5, cycle: "daily" },
      { name: "自己穿鞋", description: "自己穿好鞋子", points: 10, cycle: "daily" },
      { name: "幫忙家事", description: "幫爸爸媽媽做一件事", points: 20, cycle: "once" },
    ];
    defaultTasks.forEach((t) => batch.set(doc(tasksRef), t));
  }

  if (rewardsSnap.empty) {
    const defaultRewards = [
      { name: "看卡通 30 分鐘", description: "跟爸爸媽媽一起看", cost: 50 },
      { name: "選一個小點心", description: "任選一個小點心", cost: 80 },
      { name: "小玩具", description: "選一個小禮物", cost: 150 },
      { name: "週末家庭活動", description: "一起去公園/走走", cost: 300 },
    ];
    defaultRewards.forEach((r) => batch.set(doc(rewardsRef), r));
  }

  await batch.commit();
}

/* =====================
   initPage (core)
===================== */
function debounce(fn, wait = 80) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, wait);
  };
}

export async function initPage(renderFn, viewName) {
  state.currentView = viewName;
  window.__rerenderCurrentView = renderFn;

  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  window.addEventListener(
    "pointerdown",
    () => {
      startBgm();
    },
    { once: true }
  );

  await signInAnonymously(auth);

  const safeRender = debounce(() => {
    renderHeader();
    renderNav();
    renderFn();
  }, 60);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    userId = user.uid;
    state.isAuthReady = true;

    await ensureDefaultData();

    onSnapshot(getKidCollectionRef(), (snap) => {
      state.kids = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!state.currentKidId && state.kids[0]) {
        state.currentKidId = state.kids[0].id;
        localStorage.setItem("currentKidId", state.currentKidId);
      }
      safeRender();
    });

    onSnapshot(getTaskCollectionRef(), (snap) => {
      state.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      safeRender();
    });

    onSnapshot(getRewardCollectionRef(), (snap) => {
      state.rewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      safeRender();
    });

    onSnapshot(collection(getUserRootDoc(), "kid_states"), (snap) => {
      const next = {};
      snap.forEach((d) => (next[d.id] = d.data()));
      state.kidData = next;
      safeRender();
    });
  });
}