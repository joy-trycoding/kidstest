// js/settings.js (v3)
// Fixes in v3:
// - Switch kid should instantly update header + list highlight (relies on base.switchKid force refresh)
// - Keep modals simple: confirm/cancel always works, no extra blank buttons

import {
    state,
    initPage,
    showToast,
    getKidCollectionRef,
    getKidDocRef,
    getTaskCollectionRef,
    getRewardCollectionRef,
    showModal,
    closeModal,
    switchKid,
  } from "./base.js";
  
  import { doc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
  
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function escapeAttr(str) { return escapeHtml(str); }
  function normalizeId(id) {
    if (id === null || id === undefined) return null;
    const v = String(id).trim();
    if (!v || v.toLowerCase() === "null" || v.toLowerCase() === "undefined") return null;
    return v;
  }
  
  function renderKidList(currentKid) {
    const kids = state.kids || [];
    const list = kids.map((kid) => `
      <div class="flex items-center justify-between p-3 bg-white rounded-xl shadow-md mb-2 border-2 ${
        kid.id === currentKid?.id ? "border-primary ring-2 ring-primary/50" : "border-gray-200"
      }">
        <div class="flex-1 min-w-0 mr-4">
          <p class="font-black text-gray-800 truncate">
            ${escapeHtml(kid.nickname || "未命名")}
            ${kid.id === currentKid?.id ? '<span class="ml-2 text-xs text-secondary font-bold">目前</span>' : ""}
          </p>
          <p class="text-xs text-gray-500">年齡: ${kid.age || "未填"} / 性別: ${kid.gender || "未填"}</p>
        </div>
        <div class="flex space-x-2 items-center">
          ${
            kid.id !== currentKid?.id
              ? `<button onclick="window.switchKid('${kid.id}')" class="px-3 py-1 bg-secondary/20 text-secondary rounded-lg font-bold hover:bg-secondary/30">切換</button>`
              : ""
          }
          <button onclick="window.showEditKidModal('${kid.id}')" class="text-primary hover:text-indigo-600 text-xl" title="編輯">📝</button>
          <button onclick="window.deleteKid('${kid.id}')" class="text-danger hover:text-red-600 text-xl" title="刪除">🗑️</button>
        </div>
      </div>
    `).join("");
  
    return list || `<p class="text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">尚未新增小朋友資料。</p>`;
  }
  
  function renderTaskList() {
    const list = (state.tasks || []).map((task) => `
      <div class="flex items-center justify-between p-3 bg-bg-light rounded-xl shadow-inner mb-2 border border-gray-200">
        <div class="flex-1 min-w-0 mr-4">
          <p class="font-semibold text-gray-800 truncate">
            ${escapeHtml(task.name || "")}
            <span class="text-xs text-primary ml-2">(${task.cycle === "daily" ? "每日" : task.cycle === "weekly" ? "每週" : "一次性"})</span>
          </p>
          <p class="text-sm text-gray-500">點數: ${Number(task.points ?? 0)}</p>
        </div>
        <div class="flex space-x-2">
          <button onclick="window.showEditTaskModal('${task.id}')" class="text-primary hover:text-indigo-600 text-xl" title="編輯">📝</button>
          <button onclick="window.deleteItem('task','${task.id}')" class="text-danger hover:text-red-600 text-xl" title="刪除">🗑️</button>
        </div>
      </div>
    `).join("");
  
    return list || `<p class="text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">目前沒有設定任何任務。</p>`;
  }
  
  function renderRewardList() {
    const list = (state.rewards || []).map((reward) => `
      <div class="flex items-center justify-between p-3 bg-bg-light rounded-xl shadow-inner mb-2 border border-gray-200">
        <div class="flex-1 min-w-0 mr-4">
          <p class="font-semibold text-gray-800 truncate">${escapeHtml(reward.name || "")}</p>
          <p class="text-sm text-gray-500">兌換點數: ${Number(reward.cost ?? 0)}</p>
        </div>
        <div class="flex space-x-2">
          <button onclick="window.showEditRewardModal('${reward.id}')" class="text-primary hover:text-indigo-600 text-xl" title="編輯">📝</button>
          <button onclick="window.deleteItem('reward','${reward.id}')" class="text-danger hover:text-red-600 text-xl" title="刪除">🗑️</button>
        </div>
      </div>
    `).join("");
  
    return list || `<p class="text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">目前沒有設定任何獎勵商品。</p>`;
  }
  
  function renderSettingsContent() {
    const viewContent = document.getElementById("view-content");
    if (!viewContent) return;
  
    const currentKid = (state.kids || []).find((k) => k.id === state.currentKidId) || null;
    const isInitialSetup = (state.kids || []).length === 0;
  
    viewContent.innerHTML = `
      <div class="bg-white p-5 rounded-3xl shadow-xl border-4 border-primary/20 mb-6 pb-24">
        <h2 class="text-2xl font-black text-primary">⚙️ 家長設定中心</h2>
  
        <h3 class="text-xl font-bold mb-3 mt-6 text-gray-800">👨‍👩‍👧‍👦 小朋友資料設定</h3>
        <button onclick="window.showEditKidModal()" class="w-full py-3 mb-4 bg-pink-light text-white font-black rounded-xl hover:bg-orange-400 transition-colors shadow-md">+ 新增小朋友</button>
        ${renderKidList(currentKid)}
  
        ${
          !isInitialSetup
            ? `
          <h3 class="text-xl font-bold mb-3 mt-8 text-gray-800">✅ 任務清單管理</h3>
          <button onclick="window.showEditTaskModal()" class="w-full py-3 mb-4 bg-accent text-white font-black rounded-xl hover:bg-teal-500 transition-colors shadow-md">+ 新增任務</button>
          ${renderTaskList()}
  
          <h3 class="text-xl font-bold mb-3 mt-8 text-gray-800">🛍️ 獎勵商城編輯</h3>
          <button onclick="window.showEditRewardModal()" class="w-full py-3 mb-4 bg-accent text-white font-black rounded-xl hover:bg-teal-500 transition-colors shadow-md">+ 新增獎勵</button>
          ${renderRewardList()}
        `
            : ""
        }
      </div>
    `;
  }
  
  window.showEditKidModal = (kidId = null) => {
    const id = normalizeId(kidId);
    const isEdit = !!id;
    const kid = isEdit ? (state.kids || []).find((k) => k.id === id) || {} : {};
  
    showModal(
      isEdit ? `編輯 ${kid.nickname || ""}` : "新增小朋友資料",
      `
        <label class="block mb-2 font-medium">暱稱 (必填)</label>
        <input type="text" id="kidNickname" value="${escapeAttr(kid.nickname || "")}" class="w-full p-3 border border-gray-300 rounded-xl mb-4">
  
        <label class="block mb-2 font-medium">年齡</label>
        <input type="number" id="kidAge" value="${kid.age ?? ""}" class="w-full p-3 border border-gray-300 rounded-xl mb-4">
  
        <label class="block mb-2 font-medium">性別</label>
        <select id="kidGender" class="w-full p-3 border border-gray-300 rounded-xl">
          <option value="">請選擇</option>
          <option value="male" ${kid.gender === "male" ? "selected" : ""}>男生 👦</option>
          <option value="female" ${kid.gender === "female" ? "selected" : ""}>女生 👧</option>
        </select>
      `,
      "儲存",
      async () => {
        const nickname = (document.getElementById("kidNickname")?.value || "").trim();
        const ageRaw = (document.getElementById("kidAge")?.value || "").trim();
        const gender = document.getElementById("kidGender")?.value || "";
  
        if (!nickname) return showToast("暱稱是必填項目！", "danger");
  
        const data = { nickname, age: ageRaw ? parseInt(ageRaw, 10) : null, gender };
  
        try {
          if (id) {
            await updateDoc(doc(getKidCollectionRef(), id), data);
            showToast("小朋友資料更新成功！");
          } else {
            const ref = await addDoc(getKidCollectionRef(), data);
            showToast("小朋友資料新增成功！");
            if (ref?.id) switchKid(ref.id);
          }
          closeModal();
        } catch (e) {
          console.error(e);
          showToast(`儲存失敗: ${e?.message || e}`, "danger");
        }
      }
    );
  };
  
  window.deleteKid = async (kidId) => {
    const id = normalizeId(kidId);
    if (!id) return;
  
    if (!confirm("確定要刪除這位小朋友及其所有數據嗎？")) return;
  
    try {
      await deleteDoc(doc(getKidCollectionRef(), id));
      await deleteDoc(getKidDocRef(id));
      showToast("小朋友資料已刪除！");
    } catch (e) {
      console.error(e);
      showToast(`刪除失敗: ${e?.message || e}`, "danger");
    }
  };
  
  window.saveItem = async (type, data, itemId = null) => {
    const id = normalizeId(itemId);
    const colRef = type === "task" ? getTaskCollectionRef() : getRewardCollectionRef();
    const name = type === "task" ? "任務" : "獎勵";
  
    if (type === "task") data.points = data.points ? parseInt(data.points, 10) : 0;
    if (type === "reward") data.cost = data.cost ? parseInt(data.cost, 10) : 0;
  
    try {
      if (id) await updateDoc(doc(colRef, id), data);
      else await addDoc(colRef, data);
      showToast(`${name}${id ? "更新" : "新增"}成功！`);
      closeModal();
    } catch (e) {
      console.error(e);
      showToast(`儲存${name}失敗: ${e?.message || e}`, "danger");
    }
  };
  
  window.deleteItem = async (type, itemId) => {
    const id = normalizeId(itemId);
    if (!id) return;
  
    const colRef = type === "task" ? getTaskCollectionRef() : getRewardCollectionRef();
    const name = type === "task" ? "任務" : "獎勵";
  
    if (!confirm(`確定要刪除這個${name}嗎？`)) return;
  
    try {
      await deleteDoc(doc(colRef, id));
      showToast(`${name}已刪除！`);
    } catch (e) {
      console.error(e);
      showToast(`刪除${name}失敗: ${e?.message || e}`, "danger");
    }
  };
  
  window.showEditTaskModal = (taskId = null) => {
    const id = normalizeId(taskId);
    const task = id ? (state.tasks || []).find((t) => t.id === id) || {} : { cycle: "daily", points: 10 };
  
    showModal(
      id ? `編輯任務: ${task.name || ""}` : "新增任務",
      `
        <label class="block mb-2 font-medium">任務名稱 (必填)</label>
        <input type="text" id="taskName" value="${escapeAttr(task.name || "")}" class="w-full p-3 border border-gray-300 rounded-xl mb-4">
  
        <label class="block mb-2 font-medium">任務說明</label>
        <textarea id="taskDescription" class="w-full p-3 border border-gray-300 rounded-xl mb-4">${escapeHtml(task.description || "")}</textarea>
  
        <label class="block mb-2 font-medium">獎勵點數</label>
        <input type="number" id="taskPoints" value="${task.points ?? 10}" class="w-full p-3 border border-gray-300 rounded-xl mb-4">
  
        <label class="block mb-2 font-medium">任務週期</label>
        <select id="taskCycle" class="w-full p-3 border border-gray-300 rounded-xl">
          <option value="daily" ${task.cycle === "daily" ? "selected" : ""}>每日</option>
          <option value="weekly" ${task.cycle === "weekly" ? "selected" : ""}>每週</option>
          <option value="once" ${task.cycle === "once" ? "selected" : ""}>一次性</option>
        </select>
      `,
      "儲存",
      async () => {
        const data = {
          name: (document.getElementById("taskName")?.value || "").trim(),
          description: (document.getElementById("taskDescription")?.value || "").trim(),
          points: (document.getElementById("taskPoints")?.value || "").trim(),
          cycle: document.getElementById("taskCycle")?.value || "daily",
        };
        if (!data.name) return showToast("任務名稱是必填項目！", "danger");
        await window.saveItem("task", data, id);
      }
    );
  };
  
  window.showEditRewardModal = (rewardId = null) => {
    const id = normalizeId(rewardId);
    const reward = id ? (state.rewards || []).find((r) => r.id === id) || {} : { cost: 100 };
  
    showModal(
      id ? `編輯獎勵: ${reward.name || ""}` : "新增獎勵商品",
      `
        <label class="block mb-2 font-medium">商品名稱 (必填)</label>
        <input type="text" id="rewardName" value="${escapeAttr(reward.name || "")}" class="w-full p-3 border border-gray-300 rounded-xl mb-4">
  
        <label class="block mb-2 font-medium">商品說明</label>
        <textarea id="rewardDescription" class="w-full p-3 border border-gray-300 rounded-xl mb-4">${escapeHtml(reward.description || "")}</textarea>
  
        <label class="block mb-2 font-medium">兌換點數</label>
        <input type="number" id="rewardCost" value="${reward.cost ?? 100}" class="w-full p-3 border border-gray-300 rounded-xl">
      `,
      "儲存",
      async () => {
        const data = {
          name: (document.getElementById("rewardName")?.value || "").trim(),
          description: (document.getElementById("rewardDescription")?.value || "").trim(),
          cost: (document.getElementById("rewardCost")?.value || "").trim(),
        };
        if (!data.name) return showToast("商品名稱是必填項目！", "danger");
        await window.saveItem("reward", data, id);
      }
    );
  };
  
  initPage(renderSettingsContent, "settings");
  