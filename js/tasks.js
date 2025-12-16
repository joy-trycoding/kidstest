// js/tasks.js
// Requirements implemented:
// 1) Daily/Weekly tasks: complete -> show "已完成" + greyed + disabled until next cycle.
//    Once tasks: complete once -> greyed + disabled forever (can reset only by editing task or clearing state).
// 2) Daily points accumulation: write to kid_states.dailyPoints[YYYY-MM-DD] += points.
// 4) TTS: per-task speaker + "全部朗讀" button.
// 5) Completion sound: simple WebAudio cheer.

import { getKidStateDocRef, state, showToast, initPage, setDoc, speakText, stopSpeaking } from "./base.js";

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function weekKey(date = new Date()) {
  // ISO week (rough but good enough for this MVP)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function playCheerSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "triangle";
    o1.frequency.setValueAtTime(880, now);
    o1.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o1.connect(g1).connect(ctx.destination);
    o1.start(now);
    o1.stop(now + 0.2);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(660, now + 0.02);
    o2.frequency.exponentialRampToValueAtTime(990, now + 0.18);
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o2.connect(g2).connect(ctx.destination);
    o2.start(now + 0.02);
    o2.stop(now + 0.24);

    setTimeout(() => ctx.close(), 600);
  } catch (e) {
    // ignore
  }
}

/** 朗讀單一任務 */
window.readTaskDescription = (title, description) => {
  stopSpeaking();
  const textToRead = `任務：${title}。內容：${description}`;
  speakText(textToRead);
};

/** 朗讀今日全部任務 */
window.readAllTasks = () => {
  stopSpeaking();
  const kidId = state.currentKidId;
  const kidState = (kidId && state.kidData && state.kidData[kidId]) ? state.kidData[kidId] : { lastTaskCompletion: {} };
  const last = kidState.lastTaskCompletion || {};
  const tKey = todayKey();
  const wKey = weekKey(new Date());

  const available = (state.tasks || []).filter((task) => {
    if (!task) return false;
    const ts = last[task.id];
    if (!ts) return true;
    if (task.cycle === "daily") return new Date(ts).toDateString() !== new Date().toDateString();
    if (task.cycle === "weekly") return (typeof ts === "string" ? ts : weekKey(new Date(ts))) !== wKey;
    if (task.cycle === "once") return false;
    return true;
  });

  if (available.length === 0) {
    speakText("今天沒有待辦任務了，你很棒！");
    return;
  }
  const text = available.map((t, i) => `${i + 1}，${t.name}。${t.description || ""}`).join("。");
  speakText(`今天的任務有：${text}`);
};

/** 判斷任務是否完成（依 cycle） */
function isTaskCompleted(task, lastCompletionMap) {
  const v = lastCompletionMap?.[task.id];
  if (!v) return false;

  if (task.cycle === "daily") {
    return new Date(v).toDateString() === new Date().toDateString();
  }
  if (task.cycle === "weekly") {
    const key = typeof v === "string" ? v : weekKey(new Date(v));
    return key === weekKey(new Date());
  }
  if (task.cycle === "once") {
    return true;
  }
  // default: treat unknown as once
  return true;
}

/** 渲染任務牆 */
function renderTasksContent() {
  const viewContent = document.getElementById("view-content");
  if (!viewContent) return;

  const kidId = state.currentKidId;
  const currentKid = (state.kids || []).find((k) => k.id === kidId) || null;

  const kidState = (state.kidData && kidId && state.kidData[kidId])
    ? state.kidData[kidId]
    : { points: 0, lastTaskCompletion: {}, dailyPoints: {} };

  const lastCompletion = kidState.lastTaskCompletion || {};

  const taskCards = (state.tasks || []).map((task) => {
    if (!task) return "";

    const completed = isTaskCompleted(task, lastCompletion);

    const cardClass = completed ? "bg-gray-200 border-success/50" : "bg-white border-accent";
    const titleClass = completed ? "line-through text-gray-500" : "text-primary";
    const statusBadge = completed
      ? `<span class="ml-2 text-xs font-black px-2 py-1 rounded-full bg-success/20 text-success">已完成</span>`
      : `<span class="ml-2 text-xs font-black px-2 py-1 rounded-full bg-accent/10 text-accent">${task.cycle === "daily" ? "每日" : task.cycle === "weekly" ? "每週" : "一次性"}</span>`;

    const actionHtml = completed
      ? `
        <div class="flex items-center justify-center w-12 h-12 bg-success/50 text-white rounded-full shadow-2xl" title="已完成">
          <span class="text-2xl">✅</span>
        </div>
      `
      : `
        <button onclick="window.completeTask('${task.id}', ${Number(task.points ?? 0)})"
          class="flex items-center justify-center w-12 h-12 bg-success text-white rounded-full shadow-2xl hover:bg-green-600 transition-transform active:scale-95 transform duration-150"
          aria-label="完成任務">
          <span class="text-2xl">🎉</span>
        </button>
      `;

    return `
      <div class="flex items-center justify-between p-4 rounded-2xl shadow-lg mb-4 border-b-4 ${cardClass}">
        <div class="flex-1 min-w-0 mr-4">
          <div class="flex items-center space-x-2 mb-1">
            <p class="font-black text-xl truncate ${titleClass}">
              ${escapeHtml(task.name || "")}
            </p>
            ${statusBadge}
            <button
              onclick="window.readTaskDescription('${escapeHtml(task.name || "")}', '${escapeHtml(task.description || "")}')"
              class="ml-1 text-blue-500 hover:text-blue-700 transition duration-150"
              title="語音朗讀">
              <span class="text-lg">🔊</span>
            </button>
          </div>
          <p class="text-sm text-gray-600 mt-1 ${completed ? "opacity-80" : ""}">
            ${escapeHtml(task.description || "")}
          </p>
          ${
            completed
              ? `<p class="text-xs text-success font-bold mt-2">✅ 已完成！等下一個週期再來～</p>`
              : ""
          }
        </div>
        <div class="flex items-center space-x-3">
          <span class="text-secondary font-extrabold text-2xl whitespace-nowrap">+${Number(task.points ?? 0)}</span>
          ${actionHtml}
        </div>
      </div>
    `;
  }).join("");

  const kidNickname = currentKid?.nickname || "小朋友";
  viewContent.innerHTML = `
    <div class="p-4 bg-white rounded-xl shadow-md mb-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-lg font-bold text-gray-800">當前小朋友：${escapeHtml(kidNickname)}</p>
          <p class="text-xl font-extrabold text-secondary mt-1">點數: ${Number(kidState.points ?? 0)}</p>
        </div>
        <button onclick="window.readAllTasks()"
          class="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90">
          🔊 全部朗讀
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-3">提示：點 🎉 完成任務會加分，完成後會反灰且不可重複加分。</p>
    </div>

    <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌟 任務牆</h2>
    ${
      taskCards ||
      '<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">家長還沒有設定任何任務喔！</div>'
    }
  `;
}

/** 完成任務 */
window.completeTask = async (taskId, points) => {
  const kidId = state.currentKidId;
  if (!kidId) return showToast("請先選擇一位小朋友！", "danger");

  const task = (state.tasks || []).find((t) => t && t.id === taskId);
  if (!task) return showToast("任務資料遺失，請重新整理頁面。", "danger");

  if (!state.kidData) state.kidData = {};
  const kidState = state.kidData[kidId] || { points: 0, lastTaskCompletion: {}, dailyPoints: {} };
  const lastCompletion = kidState.lastTaskCompletion || {};

  // guard double-complete
  if (isTaskCompleted(task, lastCompletion)) {
    showToast("這個任務已經完成了喔！", "info");
    return;
  }

  const addPoints = Number(points ?? 0) || 0;
  const newPoints = Number(kidState.points ?? 0) + addPoints;

  // daily points aggregation
  const dKey = todayKey();
  const dailyPoints = kidState.dailyPoints || {};
  const todayTotal = Number(dailyPoints[dKey] ?? 0) + addPoints;

  // completion mark
  const now = Date.now();
  const completionValue = task.cycle === "weekly" ? weekKey(new Date()) : now;

  try {
    const kidRef = getKidStateDocRef(kidId);

    await setDoc(
      kidRef,
      {
        points: newPoints,
        lastTaskCompletion: {
          ...lastCompletion,
          [taskId]: completionValue,
        },
        dailyPoints: {
          ...dailyPoints,
          [dKey]: todayTotal,
        },
      },
      { merge: true }
    );

    // optimistic UI
    state.kidData[kidId] = {
      ...kidState,
      points: newPoints,
      lastTaskCompletion: {
        ...lastCompletion,
        [taskId]: completionValue,
      },
      dailyPoints: {
        ...dailyPoints,
        [dKey]: todayTotal,
      },
    };

    playCheerSound();
    showToast(`✅ 完成！獲得 ${addPoints} 點！`, "success");

    // milestone egg every 50 points
    if (Math.floor(newPoints / 50) > Math.floor(Number(kidState.points ?? 0) / 50)) {
      showToast("恭喜！您獲得了一顆精靈蛋！🥚", "success");
    }

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

initPage(renderTasksContent, "tasks");