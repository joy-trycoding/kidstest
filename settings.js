// js/settings.js
import {
    state,
    initPage,
    showToast,
    getKidCollectionRef,
    getTaskCollectionRef,
    getRewardCollectionRef,
    addDocument,
  } from "./base.js";
  
  /* ========= utilities ========= */
  function esc(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  
  /* ========= render ========= */
  function renderSettings() {
    const view = document.getElementById("view-content");
    if (!view) return;
  
    const kids = state.kids || [];
    const tasks = state.tasks || [];
    const rewards = state.rewards || [];
  
    view.innerHTML = `
    <!-- 小朋友設定 -->
    <section class="bg-white rounded-xl shadow p-4 mb-6">
      <h2 class="text-xl font-black mb-3">👶 小朋友設定</h2>
      <div class="flex gap-2 mb-3">
        <input id="kid-name" class="flex-1 p-2 border rounded-xl" placeholder="小朋友暱稱"/>
        <button onclick="addKid()" class="px-4 py-2 bg-primary text-white rounded-xl">新增</button>
      </div>
      <ul class="space-y-2">
        ${kids.map(k => `<li class="p-2 bg-gray-50 rounded">${esc(k.nickname)}</li>`).join("")}
      </ul>
    </section>
  
    <!-- 任務設定 -->
    <section class="bg-white rounded-xl shadow p-4 mb-6">
      <h2 class="text-xl font-black mb-3">📝 任務設定</h2>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <input id="task-name" class="p-2 border rounded-xl" placeholder="任務名稱"/>
        <input id="task-points" type="number" class="p-2 border rounded-xl" placeholder="點數"/>
        <input id="task-desc" class="col-span-2 p-2 border rounded-xl" placeholder="任務說明"/>
        <select id="task-cycle" class="col-span-2 p-2 border rounded-xl">
          <option value="daily">每日任務</option>
          <option value="once">一次性任務</option>
        </select>
      </div>
      <button onclick="addTask()" class="w-full py-2 bg-accent text-white rounded-xl">新增任務</button>
      <ul class="mt-4 space-y-2">
        ${tasks.map(t => `
          <li class="p-2 bg-gray-50 rounded flex justify-between">
            <span>${esc(t.name)}（${t.points} 點 / ${t.cycle}）</span>
          </li>
        `).join("")}
      </ul>
    </section>
  
    <!-- 獎勵設定 -->
    <section class="bg-white rounded-xl shadow p-4 mb-6">
      <h2 class="text-xl font-black mb-3">🎁 獎勵設定</h2>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <input id="reward-name" class="p-2 border rounded-xl" placeholder="獎勵名稱"/>
        <input id="reward-cost" type="number" class="p-2 border rounded-xl" placeholder="需要點數"/>
      </div>
      <button onclick="addReward()" class="w-full py-2 bg-secondary text-white rounded-xl">新增獎勵</button>
      <ul class="mt-4 space-y-2">
        ${rewards.map(r => `
          <li class="p-2 bg-gray-50 rounded flex justify-between">
            <span>${esc(r.name)}（${r.cost} 點）</span>
          </li>
        `).join("")}
      </ul>
    </section>
    `;
  }
  
  /* ========= actions ========= */
  window.addKid = async () => {
    const name = document.getElementById("kid-name")?.value.trim();
    if (!name) return showToast("請輸入小朋友名稱", "danger");
    await addDocument(getKidCollectionRef(), { nickname: name });
    document.getElementById("kid-name").value = "";
  };
  
  window.addTask = async () => {
    const name = document.getElementById("task-name")?.value.trim();
    const desc = document.getElementById("task-desc")?.value.trim();
    const points = Number(document.getElementById("task-points")?.value);
    const cycle = document.getElementById("task-cycle")?.value;
    if (!name || !points) return showToast("任務資料不完整", "danger");
    await addDocument(getTaskCollectionRef(), { name, description: desc, points, cycle });
  };
  
  window.addReward = async () => {
    const name = document.getElementById("reward-name")?.value.trim();
    const cost = Number(document.getElementById("reward-cost")?.value);
    if (!name || !cost) return showToast("獎勵資料不完整", "danger");
    await addDocument(getRewardCollectionRef(), { name, cost });
  };
  
  initPage(renderSettings, "settings");
  