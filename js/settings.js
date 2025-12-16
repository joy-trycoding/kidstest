// js/settings.js (final)
import { state, initPage, showToast, getKidCollectionRef, addDocument, switchKid } from "./base.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSettings() {
  const view = document.getElementById("view-content");
  if (!view) return;

  const kids = state.kids || [];
  const currentKidId = state.currentKidId;

  view.innerHTML = `
    <div class="p-4 bg-white rounded-xl shadow mb-6">
      <p class="text-xl font-black">⚙️ 小朋友設定</p>
      <p class="text-sm text-gray-500 mt-1">可建立多位小朋友，任務點數與孵蛋進度會分開記錄。</p>
    </div>

    <div class="bg-white rounded-xl shadow p-4 mb-6">
      <h3 class="font-bold mb-3">➕ 新增小朋友</h3>
      <input id="kid-name-input" type="text" placeholder="輸入小朋友暱稱"
        class="w-full p-3 border rounded-xl mb-3" maxlength="20"/>
      <button id="add-kid-btn"
        class="w-full py-3 bg-primary text-white rounded-xl font-black active:scale-95 transition">
        新增
      </button>
      <p class="text-xs text-gray-500 mt-2">提示：可以新增多位小朋友並隨時切換。</p>
    </div>

    <div class="bg-white rounded-xl shadow p-4">
      <h3 class="font-bold mb-3">👶 已建立的小朋友</h3>
      ${
        kids.length
          ? `<ul class="space-y-2">
              ${kids
                .map(
                  (k) => `
                <li class="flex items-center justify-between p-3 rounded-lg ${k.id === currentKidId ? "bg-secondary/15" : "bg-gray-50"}">
                  <span class="font-black text-gray-800 truncate">${escapeHtml(k.nickname || "小朋友")}</span>
                  <button data-kid-id="${k.id}"
                    class="px-3 py-1 text-sm rounded-full font-bold ${k.id === currentKidId ? "bg-secondary text-white" : "bg-gray-200 hover:bg-gray-300"}">
                    ${k.id === currentKidId ? "使用中" : "切換"}
                  </button>
                </li>
              `
                )
                .join("")}
            </ul>`
          : `<div class="text-center p-6 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">
              目前還沒有小朋友資料，先新增一位吧！
            </div>`
      }
    </div>

    <div class="h-24"></div>
  `;

  const btn = document.getElementById("add-kid-btn");
  if (btn) btn.onclick = addKid;

  view.querySelectorAll("button[data-kid-id]").forEach((b) => {
    b.addEventListener("click", () => switchKid(b.getAttribute("data-kid-id")));
  });
}

async function addKid() {
  const input = document.getElementById("kid-name-input");
  const nickname = input?.value?.trim();
  if (!nickname) return showToast("請輸入小朋友暱稱", "danger");

  try {
    const colRef = getKidCollectionRef();
    const docRef = await addDocument(colRef, { nickname });
    input.value = "";
    showToast("小朋友建立完成！", "success");
    switchKid(docRef.id);
  } catch (e) {
    console.error(e);
    showToast("建立失敗，請檢查連線或權限", "danger");
  }
}

initPage(renderSettings, "settings");