// js/tasks.js (final)
import { getKidStateDocRef, state, showToast, initPage, setDoc, speakText, stopSpeaking } from "./base.js";

const SFX_TASK_SUCCESS = "assets/sfx/task_success.mp3";

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function todayKeyHuman() {
  return new Date().toDateString();
}
function todayKeyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function playSfx(src) {
  try {
    const a = new Audio(src);
    a.volume = 0.75;
    a.play().catch(() => {});
  } catch {}
}

let lastCompletedTaskIdForAnim = null;

window.readTaskDescription = (taskName, taskDesc) => {
  stopSpeaking();
  const name = String(taskName ?? "").trim();
  const desc = String(taskDesc ?? "").trim();
  const text = [name, desc].filter(Boolean).join("，");
  if (!text) return;
  speakText(text);
};

function ensureCelebrationLayer() {
  let layer = document.getElementById("celebration-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.id = "celebration-layer";
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "9999";
  document.body.appendChild(layer);
  return layer;
}
function burstStickers(anchorEl, opts = {}) {
  const layer = ensureCelebrationLayer();
  const rect = (anchorEl && anchorEl.getBoundingClientRect)
    ? anchorEl.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 1, height: 1 };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const emojis = opts.emojis || ["🎉", "✨", "🌟", "👏", "🥳", "💪", "🏅"];
  const count = opts.count ?? 10;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "sticker-fly";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.fontSize = `${18 + Math.random() * 18}px`;

    const dx = (Math.random() - 0.5) * 180;
    const dy = -(90 + Math.random() * 170);
    const rot = (Math.random() - 0.5) * 260;
    const dur = 550 + Math.random() * 450;

    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    el.style.setProperty("--rot", `${rot}deg`);
    el.style.setProperty("--dur", `${dur}ms`);

    layer.appendChild(el);
    setTimeout(() => el.remove(), dur + 50);
  }
}
function megaStickerPopup(message = "太棒了！") {
  const layer = ensureCelebrationLayer();
  const el = document.createElement("div");
  el.className = "mega-pop";
  el.innerHTML = `<div class="mega-pop-inner">${escapeHtml(message)}</div>`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function renderTasksContent() {
  const viewContent = document.getElementById("view-content");
  if (!viewContent) return;

  const kidId = state.currentKidId;
  const currentKid = (state.kids || []).find((k) => k.id === kidId) || null;

  const kidState = (state.kidData && kidId && state.kidData[kidId])
    ? state.kidData[kidId]
    : { points: 0, lastTaskCompletion: {}, dailyPoints: {} };

  const points = Number(kidState.points ?? 0);
  const lastCompletion = kidState.lastTaskCompletion || {};
  const todayStr = todayKeyHuman();

  const tasks = (state.tasks || []).filter(Boolean);

  const cardsHtml = tasks.map((task) => {
    const taskId = task.id;
    const cycle = task.cycle || "daily";
    const ts = lastCompletion[taskId];
    const lastDate = ts ? new Date(ts).toDateString() : null;

    const isDoneToday = cycle === "daily" && lastDate === todayStr;
    const isDoneOnce = cycle === "once" && !!ts;
    const isCompleted = isDoneToday || isDoneOnce;

    const statusText = isDoneToday ? "已完成（明天再來）" : isDoneOnce ? "已完成（永久）" : "";
    const cardClass = [
      "task-card",
      "flex items-center justify-between p-4 rounded-2xl shadow-lg mb-4 border-b-4",
      isCompleted ? "bg-gray-100 border-gray-200 opacity-90" : "bg-white border-accent",
      lastCompletedTaskIdForAnim === taskId ? "task-pop" : ""
    ].join(" ");

    const titleClass = [
      "font-black text-xl truncate",
      isCompleted ? "text-gray-500 line-through" : "text-primary"
    ].join(" ");

    return `
      <div class="${cardClass}">
        <div class="flex-1 min-w-0 mr-4">
          <div class="flex items-center space-x-2 mb-1">
            <p class="${titleClass}">${escapeHtml(task.name || "")}</p>
            <button type="button"
              onclick="window.readTaskDescription('${escapeHtml(task.name || "")}', '${escapeHtml(task.description || "")}')"
              class="text-blue-500 hover:text-blue-700 transition duration-150"
              aria-label="朗讀任務" title="朗讀">
              <span class="text-lg">🔊</span>
            </button>
          </div>
          <p class="text-sm text-gray-600 mt-1 ${isCompleted ? "line-through" : ""}">${escapeHtml(task.description || "")}</p>
          ${statusText ? `<p class="text-xs mt-2 font-bold text-gray-500">${statusText}</p>` : ""}
        </div>

        <div class="flex items-center space-x-3">
          <span class="text-secondary font-extrabold text-2xl whitespace-nowrap">+${Number(task.points ?? 0)}</span>
          <button type="button"
            onclick="window.completeTask('${escapeHtml(taskId)}', ${Number(task.points ?? 0)}, '${escapeHtml(cycle)}', this)"
            class="task-btn flex items-center justify-center w-12 h-12 rounded-full shadow-2xl transition-transform duration-150 active:scale-95
              ${isCompleted ? "bg-gray-300 text-white cursor-not-allowed" : "bg-success text-white hover:bg-green-600"}"
            ${isCompleted ? "disabled" : ""}>
            <span class="text-2xl">${isCompleted ? "✅" : "🎉"}</span>
          </button>
        </div>
      </div>
    `;
  }).join("");

  const kidNickname = currentKid?.nickname || "小朋友";

  viewContent.innerHTML = `
    <style>
      .task-pop { animation: taskPop 0.55s cubic-bezier(.2,1.2,.2,1) both; }
      @keyframes taskPop { 0%{transform:scale(1)} 35%{transform:scale(1.03)} 100%{transform:scale(1)} }
      .points-pop { animation: pointsPop 0.6s cubic-bezier(.2,1.2,.2,1) both; }
      @keyframes pointsPop { 0%{transform:scale(1)} 40%{transform:scale(1.18)} 100%{transform:scale(1)} }
      .sticker-fly { position:absolute; transform:translate(-50%,-50%); animation: fly var(--dur) cubic-bezier(.2,1.1,.2,1) both;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,.15)); will-change: transform, opacity; }
      @keyframes fly { 0%{transform:translate(-50%,-50%) translate(0,0) rotate(0) scale(1); opacity:1;}
        70%{opacity:1;}
        100%{transform:translate(-50%,-50%) translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(1.1); opacity:0;} }
      .mega-pop { position:absolute; left:50%; top:14%; transform:translateX(-50%); animation: mega .9s cubic-bezier(.2,1.2,.2,1) both; }
      .mega-pop-inner{ background:rgba(255,255,255,.95); border:3px solid rgba(34,197,94,.35); border-radius:18px; padding:10px 16px;
        font-weight:900; color:#0f172a; box-shadow:0 14px 24px rgba(0,0,0,.12); }
      @keyframes mega { 0%{transform:translateX(-50%) translateY(-12px) scale(.6);opacity:0;}
        35%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.05);}
        100%{opacity:0;transform:translateX(-50%) translateY(-10px) scale(1);} }
    </style>

    <div class="pb-28">
      <div class="p-4 bg-white rounded-xl shadow-md mb-6 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-lg font-bold text-gray-800">當前小朋友：${escapeHtml(kidNickname)}</p>
          <p class="text-sm text-gray-500 mt-1">完成任務可累積點數，滿 50 點可以孵化一顆精靈蛋 🥚</p>
        </div>
        <div id="points-badge" class="shrink-0 px-4 py-2 rounded-2xl bg-secondary/10 text-secondary font-black text-xl">🪙 ${points}</div>
      </div>

      <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌟 任務牆</h2>
      ${cardsHtml || `<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">尚未建立任務喔！請到設定頁新增。</div>`}
    </div>
  `;

  lastCompletedTaskIdForAnim = null;
}

window.completeTask = async (taskId, points, cycle = "daily", btnEl = null) => {
  if (!state.currentKidId) return showToast("請先選擇一位小朋友！", "danger");

  const kidId = state.currentKidId;
  const kidRef = getKidStateDocRef(kidId);

  const kidState = (state.kidData && state.kidData[kidId]) ? state.kidData[kidId] : { points: 0, lastTaskCompletion: {}, dailyPoints: {} };
  const lastCompletion = kidState.lastTaskCompletion || {};
  const todayHuman = todayKeyHuman();

  const ts = lastCompletion[taskId];
  const lastDate = ts ? new Date(ts).toDateString() : null;

  if (cycle === "daily" && lastDate === todayHuman) return showToast("這個每日任務今天已完成囉！", "info");
  if (cycle === "once" && !!ts) return showToast("這個一次性任務已完成（永久）！", "info");

  try {
    const now = Date.now();
    const oldPoints = Number(kidState.points ?? 0);
    const gained = Number(points ?? 0);
    const newPoints = oldPoints + gained;

    const iso = todayKeyISO();
    const dailyPoints = { ...(kidState.dailyPoints || {}) };
    dailyPoints[iso] = Number(dailyPoints[iso] || 0) + gained;

    await setDoc(kidRef, {
      points: newPoints,
      dailyPoints,
      lastTaskCompletion: { ...lastCompletion, [taskId]: now },
    }, { merge: true });

    state.kidData[kidId] = {
      ...(kidState || {}),
      points: newPoints,
      dailyPoints,
      lastTaskCompletion: { ...lastCompletion, [taskId]: now },
    };

    playSfx(SFX_TASK_SUCCESS);
    lastCompletedTaskIdForAnim = taskId;
    burstStickers(btnEl, { count: 12 });

    const beforeUnlock = Math.floor(oldPoints / 50);
    const afterUnlock = Math.floor(newPoints / 50);
    if (afterUnlock > beforeUnlock) {
      burstStickers(btnEl, { count: 16, emojis: ["🥚", "✨", "🌟", "🎉"] });
      megaStickerPopup("🥚 可以孵化精靈蛋了！");
    }

    renderTasksContent();

    const badge = document.getElementById("points-badge");
    if (badge) {
      badge.classList.remove("points-pop");
      void badge.offsetWidth;
      badge.classList.add("points-pop");
    }

    showToast(`任務完成！獲得 ${gained} 點！`, "success");
  } catch (error) {
    console.error("Error completing task:", error);
    showToast(`完成任務失敗: ${error?.message || error}`, "danger");
  }
};

initPage(renderTasksContent, "tasks");
