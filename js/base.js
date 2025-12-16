// js/base.js
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

export const state = {
  isAuthReady: false,
  currentView: null,
  kids: [],
  currentKidId: localStorage.getItem("currentKidId") || null,
  tasks: [],
  rewards: [],
  kidData: {}, 
};

function getUserRootDoc() {
  if (!db || !userId) throw new Error("Firestore not initialized.");
  return doc(db, "artifacts", appId, "users", userId);
}

export function getKidCollectionRef() { return collection(getUserRootDoc(), "kids"); }
export function getKidDocRef(kidId) { return doc(getUserRootDoc(), "kids", kidId); }
export function getTaskCollectionRef() { return collection(getUserRootDoc(), "tasks"); }
export function getRewardCollectionRef() { return collection(getUserRootDoc(), "rewards"); }
export function getKidStateDocRef(kidId) { return doc(getUserRootDoc(), "kid_states", kidId); }

export function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;
  const bgColor = type === "success" ? "bg-success" : type === "danger" ? "bg-danger" : "bg-secondary";
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
  const { cancelText = "取消", showCancel = true } = options;
  const modalContainer = document.getElementById("modal-container");
  const modalContent = document.getElementById("modal-content");
  if (!modalContainer || !modalContent) return;
  const cancelBtnHtml = showCancel ? `<button id="modal-cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-xl">${cancelText}</button>` : "";
  modalContent.innerHTML = `
    <h3 class="text-2xl font-bold text-primary mb-4 border-b pb-2">${title}</h3>
    <div class="modal-body mb-6 text-gray-700">${bodyHtml}</div>
    <div class="flex justify-end space-x-3">
      ${cancelBtnHtml}
      <button id="modal-confirm-btn" class="px-4 py-2 ${confirmText === "刪除" ? "bg-danger" : "bg-primary"} text-white font-semibold rounded-xl">${confirmText}</button>
    </div>`;
  modalContainer.classList.remove("hidden");
  setTimeout(() => modalContent.classList.remove("scale-95", "opacity-0"), 10);
  document.getElementById("modal-confirm-btn").onclick = onConfirm;
  if (showCancel) document.getElementById("modal-cancel-btn").onclick = () => closeModal();
}

export function speakText(text) {
  try {
    if (!window.speechSynthesis || !text) return;
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = "zh-TW"; u.rate = 0.95; u.pitch = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

let _bgm = null;
export function isBgmEnabled() { return localStorage.getItem("bgmEnabled") === "1"; }
export function startBgm() { if (isBgmEnabled()) { if (!_bgm) { _bgm = new Audio("assets/bgm/forest_magic.mp3"); _bgm.loop = true; _bgm.volume = 0.25; } _bgm.play().catch(()=>{}); } }
export function stopBgm() { if (_bgm) _bgm.pause(); }

export function switchKid(kidId) {
  state.currentKidId = kidId;
  localStorage.setItem("currentKidId", kidId);
  const name = state.kids.find((k) => k.id === kidId)?.nickname || "小朋友";
  showToast(`已切換至 ${name}`, "info");
}
window.switchKid = switchKid;

function renderHeaderAndNavBar(currentView) {
  const currentKid = state.kids.find((k) => k.id === state.currentKidId);
  const kidData = state.kidData[state.currentKidId] || { points: 0 };
  const header = document.getElementById("kid-info");
  if (header) {
    header.innerHTML = `
      <div class="flex items-center space-x-3">
        <span class="text-xl font-bold text-primary">${currentKid?.nickname || "設定中..."}</span>
      </div>
      <div class="flex items-center space-x-2 p-2 bg-secondary/20 rounded-full">
        <span class="text-2xl font-extrabold text-secondary">${kidData.points || 0}</span>
        <span class="text-sm text-gray-800">點</span>
      </div>`;
  }
  const navBar = document.getElementById("nav-bar");
  if (navBar) {
    const navItems = [
      { name: "任務牆", view: "tasks", icon: "📝", link: "tasks.html" },
      { name: "精靈", view: "spirits", icon: "🥚", link: "spirits.html" },
      { name: "商店", view: "shop", icon: "🎁", link: "shop.html" },
      { name: "設定", view: "settings", icon: "⚙️", link: "settings.html" },
    ];
    navBar.innerHTML = navItems.map((item) => `
      <a href="${item.link}" class="flex flex-col items-center justify-center p-2 flex-1 ${currentView === item.view ? "text-primary font-bold bg-gray-100 rounded-lg" : "text-gray-400"}">
        <span class="text-2xl">${item.icon}</span>
        <span class="text-xs mt-1">${item.name}</span>
      </a>`).join("");
  }
}

export async function initPage(renderFn, viewName) {
  state.currentView = viewName;
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    await signInAnonymously(auth);
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      userId = user.uid;
      state.isAuthReady = true;
      onSnapshot(getKidCollectionRef(), (snap) => {
        state.kids = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (state.kids.length === 0 && viewName !== "settings") window.location.replace("settings.html");
        renderHeaderAndNavBar(viewName);
        renderFn();
        if (document.getElementById("loading-screen")) document.getElementById("loading-screen").classList.add("hidden");
      });
      onSnapshot(getTaskCollectionRef(), snap => { state.tasks = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderFn(); });
      onSnapshot(collection(getUserRootDoc(), "kid_states"), snap => {
        snap.docs.forEach(d => { state.kidData[d.id] = d.data(); });
        renderHeaderAndNavBar(viewName);
        renderFn();
      });
    });
  } catch (e) { console.error(e); }
}

export async function setDoc(ref, data, options = {merge:true}) { return fsSetDoc(ref, data, options); }
