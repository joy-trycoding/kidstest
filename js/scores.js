// js/scores.js
// Daily points page: shows dailyPoints history stored in kid_states.dailyPoints[YYYY-MM-DD]

import { state, initPage, showToast } from "./base.js";

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderScores() {
  const viewContent = document.getElementById("view-content");
  if (!viewContent) return;

  const kidId = state.currentKidId;
  if (!kidId) {
    viewContent.innerHTML = '<div class="p-6 bg-white rounded-3xl shadow-md">請先到「設定」新增小朋友。</div>';
    return;
  }

  const kid = (state.kids || []).find((k) => k.id === kidId);
  const kidState = state.kidData[kidId] || {};
  const dailyPoints = kidState.dailyPoints || {};

  const entries = Object.entries(dailyPoints)
    .filter(([k, v]) => k && v !== undefined && v !== null)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const total = entries.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);

  const max = Math.max(1, ...entries.map(([, v]) => Number(v) || 0));

  const rows = entries
    .slice(-30) // show last 30 days
    .reverse()
    .map(([date, pts]) => {
      const n = Number(pts) || 0;
      const w = Math.round((n / max) * 100);
      return `
        <div class="p-3 bg-white rounded-2xl shadow-sm border border-gray-200 mb-2">
          <div class="flex items-center justify-between">
            <div class="font-bold text-gray-800">${escapeHtml(date)}</div>
            <div class="font-black text-secondary text-xl">${n} 點</div>
          </div>
          <div class="mt-2 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-3 bg-accent" style="width:${w}%"></div>
          </div>
        </div>
      `;
    })
    .join("");

  viewContent.innerHTML = `
    <div class="bg-white p-5 rounded-3xl shadow-xl border-4 border-primary/10 mb-4">
      <h2 class="text-2xl font-black text-primary mb-2">📅 每日分數</h2>
      <p class="text-gray-700">小朋友：<span class="font-bold">${escapeHtml(kid?.nickname || "小朋友")}</span></p>
      <p class="mt-2 text-sm text-gray-500">這裡會顯示「每日完成任務累積的點數」(最近 30 天)。</p>
      <div class="mt-3 p-3 bg-secondary/10 rounded-2xl flex items-center justify-between">
        <div class="text-gray-700 font-bold">累積總分</div>
        <div class="text-3xl font-black text-secondary">${total}</div>
      </div>
    </div>

    ${
      entries.length
        ? rows
        : '<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">還沒有每日分數紀錄，先去任務牆完成任務吧！</div>'
    }
  `;
}

initPage(renderScores, "scores");