// js/tasks.js
// Tasks page: show available tasks for the current kid and let user complete them safely.
// Fixes:
// - Do NOT import Firestore helpers (doc/setDoc) from base.js (base.js doesn't export them).
// - Avoid writing to /kids/'null' by requiring a valid state.currentKidId.
// - Use setDoc(..., {merge:true}) so the kid-state doc is created if it doesn't exist.
// - Keep in-memory state.kidData in sync and re-render after completion.

import { getKidStateDocRef, state, showToast, initPage, showModal, closeModal, speakText, stopSpeaking } from "./base.js";
import { setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/** Render tasks view */
function renderTasksContent() {
  const viewContent = document.getElementById("view-content");
  if (!viewContent) return;

  const kidId = state.currentKidId;
  const currentKid = (state.kids || []).find((k) => k.id === kidId) || null;

  // Ensure local defaults
  const kidState = (state.kidData && kidId && state.kidData[kidId]) ? state.kidData[kidId] : { points: 0, lastTaskCompletion: {} };
  const lastCompletion = kidState.lastTaskCompletion || {};

  const todayStr = new Date().toDateString();

  const taskElements = (state.tasks || [])
    .filter((task) => {
      if (!task) return false;

      // daily task: hide if completed today
      if (task.cycle === "daily") {
        const ts = lastCompletion[task.id];
        const lastDate = ts ? new Date(ts).toDateString() : null;
        return lastDate !== todayStr;
      }
      return true;
    })
    .map(
      (task) => `
      <div class="flex items-center justify-between bg-white p-4 rounded-2xl shadow-lg mb-4 border-b-4 border-accent">
        <div class="flex-1 min-w-0 mr-4">
          <p class="font-black text-xl text-primary truncate">${escapeHtml(task.name || "")}</p>
          <p class="text-sm text-gray-500 mt-1">${escapeHtml(task.description || "")}</p>
        </div>
        <div class="flex items-center space-x-3">
          <span class="text-secondary font-extrabold text-2xl whitespace-nowrap">+${Number(task.points ?? 0)}</span>
          <button onclick="window.completeTask('${task.id}', ${Number(task.points ?? 0)})"
            class="flex items-center justify-center w-12 h-12 bg-success text-white rounded-full shadow-2xl hover:bg-green-600 transition-transform active:scale-95 transform duration-150"
            aria-label="完成任務">
            <span class="text-2xl">🎉</span>
          </button>
        </div>
      </div>
    `
    )
    .join("");

  const kidNickname = currentKid?.nickname || "小朋友";

  viewContent.innerHTML = `
    <div class="p-4 bg-white rounded-xl shadow-md mb-6">
      <p class="text-lg font-bold text-gray-800">當前小朋友：${escapeHtml(kidNickname)}</p>
      <p class="text-xl font-extrabold text-secondary mt-1">點數: ${Number(kidState.points ?? 0)}</p>
    </div>

    <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌟 今日待辦任務</h2>
    ${
      taskElements ||
      '<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">太棒了！所有的任務都完成了，可以去領獎勵囉！</div>'
    }
  `;
}

/** Complete a task (called from onclick) */
window.completeTask = async (taskId, points) => {
  const kidId = state.currentKidId;
  if (!kidId) {
    showToast("請先選擇一位小朋友！", "danger");
    return;
  }

  const task = (state.tasks || []).find((t) => t && t.id === taskId);
  if (!task) {
    showToast("任務資料遺失，請重新整理頁面。", "danger");
    console.error("Attempted to complete non-existent task:", taskId);
    return;
  }

  // Local defaults
  if (!state.kidData) state.kidData = {};
  const kidState = state.kidData[kidId] || { points: 0, lastTaskCompletion: {} };
  const lastCompletion = kidState.lastTaskCompletion || {};

  const now = Date.now();
  const todayStr = new Date().toDateString();

  // Prevent double completion for daily tasks (client-side guard)
  if (task.cycle === "daily") {
    const ts = lastCompletion[taskId];
    const lastDate = ts ? new Date(ts).toDateString() : null;
    if (lastDate === todayStr) {
      showToast("這個每日任務今天已經完成了喔！", "info");
      return;
    }
  }

  const addPoints = Number(points ?? 0) || 0;
  const newPoints = Number(kidState.points ?? 0) + addPoints;

  try {
    const kidRef = getKidStateDocRef(kidId);

    // Create or update safely
    await setDoc(
      kidRef,
      {
        points: newPoints,
        lastTaskCompletion: {
          ...lastCompletion,
          [taskId]: now,
        },
      },
      { merge: true }
    );

    // Sync local state to prevent UI flicker and support offline-ish UX
    state.kidData[kidId] = {
      ...kidState,
      points: newPoints,
      lastTaskCompletion: {
        ...lastCompletion,
        [taskId]: now,
      },
    };

    showToast(`任務完成！獲得 ${addPoints} 點！`, "success");

    // milestone toast (every 50 points)
    if (Math.floor(newPoints / 50) > Math.floor(Number(kidState.points ?? 0) / 50)) {
      showToast("恭喜！您獲得了一顆精靈蛋！🥚", "success");
    }

    // Re-render
    renderTasksContent();
  } catch (error) {
    console.error("Error completing task:", error);
    if (error?.code === "permission-denied") {
      showToast("任務失敗：權限不足。請檢查 Firebase 安全規則。", "danger");
    } else {
      showToast(`完成任務失敗: ${error?.message || error}`, "danger");
    }
  }
};

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Bootstrap
initPage(renderTasksContent, "tasks");
const INTRO_SEEN_KEY = 'intro_story_seen_v1';
const INTRO_TITLE = "🌲 神秘森林的求救訊號";
const INTRO_STORY = `很久很久以前，森林裡的精靈們被神秘魔法封印，只能躲進精靈蛋裡沉睡。
他們需要小朋友的「主動能量」——每完成一個任務，就能獲得金幣，金幣會喚醒精靈蛋，讓精靈重獲自由。
完成任務不只可以拯救精靈，還能累積金幣，向爸爸媽媽兌換獎勵喔！
✨ 森林的命運，就交給你了！`;

function showIntroOnce() {
    try {
        if (localStorage.getItem(INTRO_SEEN_KEY) === '1') return;
        localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {}

    // stop any ongoing speech
    try { stopSpeaking(); } catch {}

    const img = 'assets/egg.png'; // you can replace with assets/intro.png later
    showModal(
        INTRO_TITLE,
        `
        <div class="flex flex-col md:flex-row gap-4 items-center">
            <div class="w-40 h-40 bg-gray-50 rounded-3xl shadow-inner flex items-center justify-center overflow-hidden">
                <img src="${img}" alt="intro" class="w-full h-full object-contain" onerror="this.style.display='none'">
                <div class="text-6xl ${img ? 'hidden' : ''}">🥚</div>
            </div>
            <div class="flex-1">
                <p class="text-gray-700 leading-relaxed whitespace-pre-line">${INTRO_STORY}</p>
                <div class="mt-4 flex gap-3">
                    <button id="intro-tts" class="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90">🔊 聽故事</button>
                </div>
            </div>
        </div>
        `,
        "開始任務",
        () => closeModal()
    );

    // bind tts
    setTimeout(() => {
        const btn = document.getElementById('intro-tts');
        if (btn) btn.onclick = () => speakText(INTRO_STORY);
    }, 0);
}