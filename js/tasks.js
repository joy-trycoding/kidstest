// js/tasks.js (v3)
// Fixes in v3:
// 1) "once" tasks: after first completion, permanently disabled (client guard + UI)
// 2) completion sound works for every click (reuse one AudioContext)
// 3) TTS reads only description (or name if description missing)
// 4) RWD: add bottom padding so last card won't be hidden by fixed footer
// 5) writes dailyPoints aggregation for Scores page

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
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ---- sound (reusable ctx) ----
let sfxCtx = null;
function ensureSfxCtx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sfxCtx) sfxCtx = new AudioCtx();
  if (sfxCtx.state === "suspended") sfxCtx.resume().catch(() => {});
  return sfxCtx;
}
function playCheerSound() {
  const ctx = ensureSfxCtx();
  if (!ctx) return;

  const t0 = ctx.currentTime;
  const mk = (type, f1, f2, dur, gainPeak) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t0);
    osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);
  };
  mk("triangle", 880, 1320, 0.18, 0.22);
  mk("sine", 660, 990, 0.22, 0.16);
}

// ---- speech ----
window.readTask = (desc, name) => {
  stopSpeaking();
  const text = (desc || "").trim() ? desc : (name || "");
  if (!text) return;
  speakText(text);
};
window.readAllTasks = () => {
  stopSpeaking();
  const kidId = state.currentKidId;
  const kidState = (kidId && state.kidData && state.kidData[kidId]) ? state.kidData[kidId] : { lastTaskCompletion: {} };
  const last = kidState.lastTaskCompletion || {};
  const wKey = weekKey(new Date());
  const todayStr = new Date().toDateString();

  const available = (state.tasks || []).filter((task) => {
    if (!task) return false;
    const ts = last[task.id];
    if (!ts) return true;
    if (task.cycle === "daily") return new Date(ts).toDateString() !== todayStr;
    if (task.cycle === "weekly") return (typeof ts === "string" ? ts : weekKey(new Date(ts))) !== wKey;
    if (task.cycle === "once") return false;
    return false;
  });

  if (!available.length) return speakText("今天沒有待辦任務了，你很棒！");
  const text = available.map((t) => (t.description || t.name || "")).filter(Boolean).join("。");
  speakText(text);
};

// ---- completion check ----
function isTaskCompleted(task, lastMap) {
  const v = lastMap?.[task.id];
  if (!v) return false;

  if (task.cycle === "daily") return new Date(v).toDateString() === new Date().toDateString();
  if (task.cycle === "weekly") {
    const key = typeof v === "string" ? v : weekKey(new Date(v));
    return key === weekKey(new Date());
  }
  if (task.cycle === "once") return true;
  // default: treat unknown as once
  return true;
}

function renderTasksContent() {
  const viewContent = document.getElementById("view-content");
  if (!viewContent) return;

  const kidId = state.currentKidId;
  const currentKid = (state.kids || []).find((k) => k.id === kidId) || null;

  const kidState = (state.kidData && kidId && state.kidData[kidId])
    ? state.kidData[kidId]
    : { points: 0, lastTaskCompletion: {}, dailyPoints: {} };

  const last = kidState.lastTaskCompletion || {};

  const cards = (state.tasks || []).map((task) => {
    if (!task) return "";

    const completed = isTaskCompleted(task, last);

    const cardClass = completed ? "bg-gray-200 border-success/50" : "bg-white border-accent";
    const titleClass = completed ? "line-through text-gray-500" : "text-primary";
    const badge = completed
      ? `<span class="ml-2 text-xs font-black px-2 py-1 rounded-full bg-success/20 text-success">已完成</span>`
      : `<span class="ml-2 text-xs font-black px-2 py-1 rounded-full bg-accent/10 text-accent">${task.cycle === "daily" ? "每日" : task.cycle === "weekly" ? "每週" : "一次性"}</span>`;

    const action = completed
      ? `<div class="flex items-center justify-center w-12 h-12 bg-success/50 text-white rounded-full shadow-2xl"><span class="text-2xl">✅</span></div>`
      : `<button onclick="window.completeTask('${task.id}', ${Number(task.points ?? 0)})"
            class="flex items-center justify-center w-12 h-12 bg-success text-white rounded-full shadow-2xl hover:bg-green-600 transition-transform active:scale-95 transform duration-150">
            <span class="text-2xl">🎉</span></button>`;

    return `
      <div class="flex items-center justify-between p-4 rounded-2xl shadow-lg mb-4 border-b-4 ${cardClass}">
        <div class="flex-1 min-w-0 mr-4">
          <div class="flex items-center space-x-2 mb-1">
            <p class="font-black text-xl truncate ${titleClass}">${escapeHtml(task.name || "")}</p>
            ${badge}
            <button onclick="window.readTask('${escapeHtml(task.description || "")}','${escapeHtml(task.name || "")}')"
              class="ml-1 text-blue-500 hover:text-blue-700" title="語音朗讀"><span class="text-lg">🔊</span></button>
          </div>
          <p class="text-sm text-gray-600 mt-1 ${completed ? "opacity-80" : ""}">${escapeHtml(task.description || "")}</p>
          ${completed ? `<p class="text-xs text-success font-bold mt-2">✅ 已完成！等下一個週期再來～</p>` : ""}
        </div>
        <div class="flex items-center space-x-3">
          <span class="text-secondary font-extrabold text-2xl whitespace-nowrap">+${Number(task.points ?? 0)}</span>
          ${action}
        </div>
      </div>
    `;
  }).join("");

  const kidNickname = currentKid?.nickname || "小朋友";

  viewContent.innerHTML = `
    <div class="pb-28"> <!-- RWD fix: leave space for fixed footer -->
      <div class="p-4 bg-white rounded-xl shadow-md mb-4">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-lg font-bold text-gray-800 truncate">當前小朋友：${escapeHtml(kidNickname)}</p>
            <p class="text-xl font-extrabold text-secondary mt-1">點數: ${Number(kidState.points ?? 0)}</p>
          </div>
          <button onclick="window.readAllTasks()" class="shrink-0 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90">
            🔊 全部朗讀
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-3">提示：完成後會反灰且不可重複加分（每日/每週要等下一個周期）。</p>
      </div>

      <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌟 任務牆</h2>
      ${
        cards ||
        '<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">家長還沒有設定任何任務喔！</div>'
      }
    </div>
  `;
}

window.completeTask = async (taskId, points) => {
  const kidId = state.currentKidId;
  if (!kidId) return showToast("請先選擇一位小朋友！", "danger");

  const task = (state.tasks || []).find((t) => t && t.id === taskId);
  if (!task) return showToast("任務資料遺失，請重新整理頁面。", "danger");

  if (!state.kidData) state.kidData = {};
  const kidState = state.kidData[kidId] || { points: 0, lastTaskCompletion: {}, dailyPoints: {} };
  const last = kidState.lastTaskCompletion || {};

  // HARD GUARD: once tasks can never be repeated
  if (isTaskCompleted(task, last)) {
    showToast(task.cycle === "once" ? "這個一次性任務已經完成過囉！" : "這個任務本周期已完成！", "info");
    return;
  }

  const add = Number(points ?? 0) || 0;
  const newPoints = Number(kidState.points ?? 0) + add;

  const dKey = todayKey();
  const dailyPoints = kidState.dailyPoints || {};
  const todayTotal = Number(dailyPoints[dKey] ?? 0) + add;

  const completionValue = task.cycle === "weekly" ? weekKey(new Date()) : Date.now();

  try {
    const ref = getKidStateDocRef(kidId);

    await setDoc(ref, {
      points: newPoints,
      lastTaskCompletion: { ...last, [taskId]: completionValue },
      dailyPoints: { ...dailyPoints, [dKey]: todayTotal },
    }, { merge: true });

    // optimistic state update
    state.kidData[kidId] = {
      ...kidState,
      points: newPoints,
      lastTaskCompletion: { ...last, [taskId]: completionValue },
      dailyPoints: { ...dailyPoints, [dKey]: todayTotal },
    };

    playCheerSound();
    showToast(`✅ 完成！獲得 ${add} 點！`, "success");
    renderTasksContent();
  } catch (e) {
    console.error(e);
    showToast(`完成任務失敗: ${e?.message || e}`, "danger");
  }
};

initPage(renderTasksContent, "tasks");