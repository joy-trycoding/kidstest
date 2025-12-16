// js/base.js
// Shared Firebase + UI state + helpers for KIDSTEST

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
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Constants and Configuration ---
const appId = "autonomy-helper-mock-id";
let app, db, auth, userId;
let renderCallback = () => {};
let currentSpeech = null;

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDZ6A9haTwY6dCa93Tsa1X63ehzx-xe_FE",
  authDomain: "kidstest-99c7f.firebaseapp.com",
  projectId: "kidstest-99c7f",
  storageBucket: "kidstest-99c7f.firebasestorage.app",
  messagingSenderId: "4719977826",
  appId: "1:4719977826:web:e002e7b9b2036d3b39339e",
};

// --- Global State ---
const state = {
  isAuthReady: false,
  kids: [],
  currentKidId: localStorage.getItem("currentKidId") || null,
  tasks: [],
  rewards: [],
  // per-kid state: { kidId: { points, spirits, redemptions, lastTaskCompletion, dailyPoints ... } }
  kidData: {},
  isSpeaking: false,
};

// --- Firestore references ---
function getUserArtifactsRef() {
  if (!userId) throw new Error("User not authenticated.");
  return doc(db, "artifacts", appId, "users", userId);
}
function getKidCollectionRef() {
  return collection(getUserArtifactsRef(), "kids");
}
function getTaskCollectionRef() {
  return collection(getUserArtifactsRef(), "tasks");
}
function getRewardCollectionRef() {
  return collection(getUserArtifactsRef(), "rewards");
}
// kid_states/{kidId} : points + completion + dailyPoints...
function getKidStateDocRef(kidId) {
  return doc(getUserArtifactsRef(), "kid_states", kidId);
}
// For legacy imports in shop/spirits
const getKidDocRef = getKidStateDocRef;

// --- Default data (seed) ---
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
  const taskQuery = await getDocs(getTaskCollectionRef());
  const rewardQuery = await getDocs(getRewardCollectionRef());

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
}

// --- Toast & Modal ---
function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;

  const bgColor =
    type === "success" ? "bg-success" : type === "danger" ? "bg-danger" : "bg-secondary";

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

function closeModal() {
  const modalContainer = document.getElementById("modal-container");
  const modalContent = document.getElementById("modal-content");
  if (!modalContainer || !modalContent) return;

  modalContent.classList.add("scale-95", "opacity-0");
  modalContent.addEventListener(
    "transitionend",
    () => {
      modalContainer.classList.add("hidden");
    },
    { once: true }
  );

  stopSpeaking();
}
window.closeModal = closeModal;

function showModal(title, bodyHtml, confirmText = "確定", onConfirm = () => {}) {
  const modalContainer = document.getElementById("modal-container");
  const modalContent = document.getElementById("modal-content");
  if (!modalContainer || !modalContent) return;

  const isDelete = confirmText === "刪除";
  const confirmBtnClass = isDelete ? "bg-danger" : "bg-primary";

  modalContent.innerHTML = `
    <h3 class="text-2xl font-bold text-primary mb-4 border-b pb-2">${title}</h3>
    <div class="modal-body mb-6 text-gray-700">${bodyHtml}</div>
    <div class="flex justify-end space-x-3">
      <button type="button" onclick="window.closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition duration-150">取消</button>
      <button type="button" id="modal-confirm-btn" class="px-4 py-2 ${confirmBtnClass} text-white font-semibold rounded-xl hover:opacity-80 transition duration-150">${confirmText}</button>
    </div>
  `;

  modalContainer.classList.remove("hidden");
  setTimeout(() => modalContent.classList.remove("scale-95", "opacity-0"), 10);

  const confirmBtn = document.getElementById("modal-confirm-btn");
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      try {
        await onConfirm();
      } finally {
        // onConfirm can choose to keep open, but default is close
        window.closeModal();
      }
    };
  }
}

// --- Text-to-Speech ---
function stopSpeaking() {
  if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  state.isSpeaking = false;
  if (renderCallback) renderCallback();
}

function speakText(text) {
  stopSpeaking();

  if (!("speechSynthesis" in window)) {
    showToast("您的瀏覽器不支持語音朗讀功能！", "danger");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();
  const zh = voices.find((v) => v.lang && v.lang.startsWith("zh-"));
  if (zh) utterance.voice = zh;
  else utterance.lang = "zh-TW";

  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    state.isSpeaking = true;
    if (renderCallback) renderCallback();
  };
  utterance.onend = () => {
    state.isSpeaking = false;
    if (renderCallback) renderCallback();
  };
  utterance.onerror = () => {
    state.isSpeaking = false;
    if (renderCallback) renderCallback();
  };

  window.speechSynthesis.speak(utterance);
  currentSpeech = utterance;
}

// --- Kid switch ---
const switchKid = (kidId) => {
  state.currentKidId = kidId;
  localStorage.setItem("currentKidId", kidId);
  showToast(
    `已切換至 ${state.kids.find((k) => k.id === kidId)?.nickname || "新小朋友"}`,
    "info"
  );
  stopSpeaking();
  if (renderCallback) renderCallback();
};
window.switchKid = switchKid;

// --- Header / Nav ---
function renderHeaderAndNavBar(currentView, fallbackKidNickname = "設定中...") {
  const currentKid = state.kids.find((k) => k.id === state.currentKidId);
  const currentKidData = state.kidData[state.currentKidId] || { points: 0 };

  const header = document.getElementById("kid-info");
  if (header) {
    header.innerHTML = `
      <div class="flex items-center space-x-3">
        <span class="text-xl font-bold text-primary">${currentKid ? currentKid.nickname : fallbackKidNickname}</span>
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

// --- Listeners ---
function setupListeners(pageViewName) {
  const updateUI = () => {
    const currentKid = state.kids.find((k) => k.id === state.currentKidId);
    renderHeaderAndNavBar(pageViewName, currentKid?.nickname || "設定中...");
    renderCallback();
  };

  const handleError = (error, collectionName) => {
    console.error(`[Base] Listener failed for ${collectionName}:`, error);
    showToast(`數據讀取失敗 (${collectionName})。請檢查網路或 Firestore 規則。`, "danger");
  };

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
    (error) => handleError(error, "Kids")
  );

  onSnapshot(
    getTaskCollectionRef(),
    (snapshot) => {
      state.tasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateUI();
    },
    (error) => handleError(error, "Tasks")
  );

  onSnapshot(
    getRewardCollectionRef(),
    (snapshot) => {
      state.rewards = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateUI();
    },
    (error) => handleError(error, "Rewards")
  );

  const kidStatesRef = collection(getUserArtifactsRef(), "kid_states");
  onSnapshot(
    kidStatesRef,
    (snapshot) => {
      state.kidData = {};
      snapshot.docs.forEach((d) => {
        state.kidData[d.id] = { id: d.id, ...d.data() };
      });
      updateUI();
    },
    (error) => handleError(error, "Kid States")
  );
}

// --- initPage ---
function initPage(pageRenderFunc, pageViewName) {
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
          console.error("[Base] Firebase auth failed (user null).");
          if (loadingScreen) loadingScreen.classList.add("hidden");
          if (content) {
            content.classList.remove("hidden");
            content.innerHTML = `
              <div class="text-center p-10 bg-danger/10 rounded-3xl mt-8 shadow-inner border border-danger">
                <p class="text-3xl font-bold text-danger mb-4">🚫 Firebase 連線失敗</p>
                <p class="text-gray-700 font-medium">請確認 Firebase 已啟用匿名登入 (Anonymous)。</p>
              </div>
            `;
          }
          return;
        }

        userId = user.uid;
        state.isAuthReady = true;

        await preloadInitialData();
        setupListeners(pageViewName);

        // One-shot first sync check for kids
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
      console.error("[Base] Fatal init error:", error);
      if (loadingScreen) loadingScreen.classList.add("hidden");
      if (content) {
        content.classList.remove("hidden");
        content.innerHTML = `
          <div class="text-center p-8 bg-danger/10 rounded-xl shadow-lg mt-8">
            <p class="text-xl font-bold text-danger">應用程式初始化失敗</p>
            <p class="mt-2 text-sm text-gray-700">錯誤訊息: ${error.message}</p>
          </div>
        `;
      }
    }
  })();
}

// --- Exports ---
export { getFirestore, getDoc, setDoc, writeBatch, arrayUnion, getDocs, doc, collection };
export {
  state,
  showToast,
  showModal,
  closeModal,
  switchKid,
  speakText,
  stopSpeaking,
  getKidCollectionRef,
  getTaskCollectionRef,
  getRewardCollectionRef,
  getKidStateDocRef,
  getKidDocRef,
  initPage,
};