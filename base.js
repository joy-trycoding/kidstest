// js/base.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc as fsSetDoc,
  onSnapshot,
  collection,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* =====================
   Firebase 設定
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
   全域狀態
===================== */
export const state = {
  isAuthReady: false,
  currentView: null,
  kids: [],
  currentKidId: localStorage.getItem("currentKidId") || null,
  tasks: [],
  rewards: [],
  kidData: {},
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
   UI：Toast
===================== */
export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const div = document.createElement("div");
  div.className = `p-4 mb-2 rounded-xl text-white shadow transition bg-${type === "danger" ? "danger" : "success"}`;
  div.innerText = message;
  container.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

/* =====================
   UI：Modal
===================== */
export function closeModal() {
  const m = document.getElementById("modal-container");
  const c = document.getElementById("modal-content");
  if (!m || !c) return;
  m.classList.add("hidden");
  c.innerHTML = "";
}
window.closeModal = closeModal;

export function showModal(title, bodyHtml, confirmText, onConfirm) {
  const m = document.getElementById("modal-container");
  const c = document.getElementById("modal-content");
  if (!m || !c) return;

  c.innerHTML = `
    <h3 class="text-xl font-black mb-4">${title}</h3>
    <div class="mb-6">${bodyHtml}</div>
    <div class="flex justify-end gap-3">
      <button id="modal-ok" class="px-4 py-2 bg-primary text-white rounded-xl">${confirmText}</button>
    </div>
  `;
  m.classList.remove("hidden");
  document.getElementById("modal-ok").onclick = onConfirm;
}

/* =====================
   語音
===================== */
export function speakText(text) {
  if (!window.speechSynthesis || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-TW";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* =====================
   背景音樂
===================== */
let bgm;
export function startBgm() {
  if (!bgm) {
    bgm = new Audio("assets/bgm/forest_magic.mp3");
    bgm.loop = true;
    bgm.volume = 0.3;
  }
  bgm.play().catch(() => {});
}
export function stopBgm() {
  if (bgm) bgm.pause();
}

/* =====================
   Header / Nav
===================== */
function renderHeader(view) {
  const header = document.getElementById("kid-info");
  const kid = state.kids.find(k => k.id === state.currentKidId);
  const data = state.kidData[state.currentKidId] || { points: 0 };
  if (!header) return;
  header.innerHTML = `
    <div class="font-bold">${kid?.nickname || "設定中..."}</div>
    <div class="bg-secondary/20 px-3 py-1 rounded-full">${data.points || 0} 點</div>
  `;
}

function renderNav(view) {
  const nav = document.getElementById("nav-bar");
  if (!nav) return;
  nav.innerHTML = `
    <a href="tasks.html">📝</a>
    <a href="spirits.html">🥚</a>
    <a href="shop.html">🎁</a>
    <a href="settings.html">⚙️</a>
  `;
}

/* =====================
   initPage（核心）
===================== */
export async function initPage(renderFn, viewName) {
  state.currentView = viewName;
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  await signInAnonymously(auth);

  onAuthStateChanged(auth, user => {
    if (!user) return;
    userId = user.uid;

    onSnapshot(getKidCollectionRef(), snap => {
      state.kids = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!state.currentKidId && state.kids[0]) {
        state.currentKidId = state.kids[0].id;
      }
      renderHeader(viewName);
      renderNav(viewName);
      renderFn();
    });

    onSnapshot(getTaskCollectionRef(), snap => {
      state.tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFn();
    });

    onSnapshot(collection(getUserRootDoc(), "kid_states"), snap => {
      snap.forEach(d => state.kidData[d.id] = d.data());
      renderHeader(viewName);
      renderFn();
    });
  });
}

export async function setDoc(ref, data, options = { merge: true }) {
  return fsSetDoc(ref, data, options);
}
async function ensureDefaultData() {
    const tasksRef = getTaskCollectionRef();
    const rewardsRef = getRewardCollectionRef();
  
    const tasksSnap = await getDocs(tasksRef);
    const rewardsSnap = await getDocs(rewardsRef);
  
    const batch = writeBatch(db);
  
    if (tasksSnap.empty) {
      const defaultTasks = [
        { name: "整理玩具", description: "自己把玩具收好", points: 10, cycle: "daily" },
        { name: "刷牙洗臉", description: "早晚刷牙洗臉", points: 5, cycle: "daily" },
        { name: "幫忙家事", description: "幫爸爸媽媽做一件事", points: 20, cycle: "once" },
      ];
      defaultTasks.forEach(t => batch.set(doc(tasksRef), t));
    }
  
    if (rewardsSnap.empty) {
      const defaultRewards = [
        { name: "看卡通 30 分鐘", cost: 50 },
        { name: "小玩具", cost: 150 },
        { name: "家庭活動", cost: 300 },
      ];
      defaultRewards.forEach(r => batch.set(doc(rewardsRef), r));
    }
  
    await batch.commit();
  }
  