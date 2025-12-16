// js/tasks.js
// Tasks page: show available tasks for the current kid and let user complete them safely.
// Fixes:
// - Do NOT import Firestore helpers (doc/setDoc) from base.js (base.js doesn't export them).
// - Avoid writing to /kids/'null' by requiring a valid state.currentKidId.
// - Use setDoc(..., {merge:true}) so the kid-state doc is created if it doesn't exist.
// - Keep in-memory state.kidData in sync and re-render after completion.

import { getKidStateDocRef, state, showToast, initPage } from "./base.js";
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


