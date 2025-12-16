// js/settings.js
import {
    state,
    initPage,
    showToast,
    getKidCollectionRef,
    setDoc,
    switchKid,
  } from "./base.js";
  
  /* =========================
     Render
  ========================= */
  function renderSettings() {
    const view = document.getElementById("view-content");
    if (!view) return;
  
    const kids = state.kids || [];
    const currentKidId = state.currentKidId;
  
    let html = `
      <div class="p-4 bg-white rounded-xl shadow mb-6">
        <p class="text-xl font-bold">⚙️ 小朋友設定</p>
        <p class="text-sm text-gray-500 mt-1">
          可建立與切換小朋友，所有任務與精靈會依小朋友分開記錄。
        </p>
      </div>
  
      <!-- 新增小朋友 -->
      <div class="bg-white rounded-xl shadow p-4 mb-6">
        <h3 class="font-bold mb-3">➕ 新增小朋友</h3>
        <input
          id="kid-name-input"
          type="text"
          placeholder="輸入小朋友暱稱"
          class="w-full p-3 border rounded-xl mb-3"
        />
        <button
          onclick="window.addKid()"
          class="w-full py-3 bg-primary text-white rounded-xl font-bold"
        >
          新增
        </button>
      </div>
    `;
  
    /* -------- 已建立的小朋友 -------- */
    if (kids.length > 0) {
      html += `
        <div class="bg-white rounded-xl shadow p-4">
          <h3 class="font-bold mb-3">👶 已建立的小朋友</h3>
          <ul class="space-y-2">
            ${kids
              .map(
                (k) => `
              <li class="flex items-center justify-between p-3 rounded-lg
                ${k.id === currentKidId ? "bg-secondary/20" : "bg-gray-50"}">
                <span class="font-medium">${k.nickname}</span>
                <button
                  onclick="switchKid('${k.id}')"
                  class="px-3 py-1 text-sm rounded-full
                    ${k.id === currentKidId
                      ? "bg-secondary text-white"
                      : "bg-gray-200 hover:bg-gray-300"}"
                >
                  ${k.id === currentKidId ? "使用中" : "切換"}
                </button>
              </li>
            `
              )
              .join("")}
          </ul>
        </div>
      `;
    }
  
    view.innerHTML = html;
  }
  
  /* =========================
     新增 Kid
  ========================= */
  window.addKid = async function () {
    const input = document.getElementById("kid-name-input");
    const nickname = input?.value?.trim();
  
    if (!nickname) {
      showToast("請輸入小朋友暱稱", "danger");
      return;
    }
  
    try {
      const colRef = getKidCollectionRef();
      // 使用 auto-id
      await setDoc(
        // Firestore collection + auto id
        colRef._path ? colRef : colRef, // 保留穩定寫法
        { nickname },
        { merge: true }
      );
  
      input.value = "";
      showToast("小朋友建立完成！", "success");
    } catch (e) {
      console.error(e);
      showToast("建立失敗，請檢查連線或權限", "danger");
    }
  };
  
  /* =========================
     Init
  ========================= */
  initPage(renderSettings, "settings");
  