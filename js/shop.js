// js/shop.js (final)
import { state, initPage, showToast, getKidStateDocRef, setDoc, showModal, closeModal } from "./base.js";

const SFX_REDEEM = "assets/sfx/redeem_success.mp3";

function playSfx(src) {
  try {
    const a = new Audio(src);
    a.volume = 0.8;
    a.play().catch(() => {});
  } catch {}
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderShopContent() {
  const viewContent = document.getElementById("view-content");
  if (!viewContent) return;

  const kidId = state.currentKidId;
  if (!kidId) {
    viewContent.innerHTML = '<div class="p-6 bg-white rounded-3xl shadow-md">請先到「設定」新增小朋友。</div>';
    return;
  }

  const kidState = state.kidData[kidId] || { points: 0, redemptions: [] };
  const currentPoints = Number(kidState.points || 0);

  const rewards = (state.rewards || []).filter(Boolean);

  const rewardCards = rewards
    .map((reward) => {
      const cost = Number(reward.cost || 0);
      const canRedeem = currentPoints >= cost;

      return `
        <div class="bg-white p-5 rounded-3xl shadow-xl flex flex-col justify-between h-full border-4 border-pink-light/50 transition-all duration-300">
          <div class="text-center">
            <p class="text-4xl mb-3">🎁</p>
            <p class="text-xl font-black text-gray-800 mb-2">${escapeHtml(reward.name || "")}</p>
            <p class="text-sm text-gray-500 mb-4">${escapeHtml(reward.description || "")}</p>
          </div>
          <div class="mt-auto">
            <div class="flex items-center justify-center mb-3 p-2 bg-secondary/20 rounded-xl">
              <span class="text-lg font-bold mr-2">需要點數:</span>
              <span class="text-secondary font-extrabold text-3xl">${cost}</span>
            </div>

            <button
              onclick="window.redeemReward('${escapeHtml(reward.id)}', ${cost})"
              class="w-full py-3 rounded-2xl text-white font-black transition-colors shadow-lg
                ${canRedeem ? "bg-accent hover:bg-teal-500 active:scale-95" : "bg-gray-400 cursor-not-allowed"}"
              ${canRedeem ? "" : "disabled"}
            >
              ${canRedeem ? "兌換獎勵 ✨" : `還差 ${cost - currentPoints} 點`}
            </button>

            <p class="text-xs text-gray-400 mt-3 text-center">提醒：點數不會扣除，只會記錄兌換</p>
          </div>
        </div>
      `;
    })
    .join("");

  viewContent.innerHTML = `
    <div class="text-center p-4 mb-8 rounded-3xl bg-primary shadow-2xl text-white border-4 border-indigo-600">
      <p class="text-xl font-bold">目前累積點數</p>
      <p class="text-6xl font-black text-secondary">${currentPoints}</p>
    </div>

    <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🛍️ 獎勵商城</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${rewardCards || '<div class="col-span-full text-center p-8 bg-gray-100 rounded-2xl text-gray-500 shadow-inner">目前沒有獎勵，請稍後重整（會自動建立預設獎勵）。</div>'}
    </div>
  `;
}

window.redeemReward = (rewardId, cost) => {
  if (!state.currentKidId) return showToast("請先選擇一位小朋友！", "danger");

  const kidState = state.kidData[state.currentKidId] || { points: 0 };
  if (Number(kidState.points || 0) < Number(cost || 0)) {
    return showToast("點數不足！請多努力完成任務！", "danger");
  }

  const reward = (state.rewards || []).find((r) => r.id === rewardId);

  showModal(
    "確認兌換",
    `<p class="text-lg text-gray-700">確定要用 <span class="text-secondary font-black">${Number(cost || 0)} 點</span> 兌換「<span class="font-black">${escapeHtml(reward?.name || "")}</span>」嗎？</p>
     <p class="text-sm text-gray-500 mt-2">（點數不會扣除，會留下兌換紀錄，方便家長核對）</p>`,
    "確定兌換",
    async () => {
      await confirmRedemption(rewardId, cost);
    }
  );
};

async function confirmRedemption(rewardId, cost) {
  closeModal();
  const kidId = state.currentKidId;
  const kidRef = getKidStateDocRef(kidId);
  const kidState = state.kidData[kidId] || {};
  const redemptions = Array.isArray(kidState.redemptions) ? kidState.redemptions : [];

  try {
    await setDoc(
      kidRef,
      {
        redemptions: [
          ...redemptions,
          { rewardId, cost: Number(cost || 0), timestamp: Date.now() },
        ],
      },
      { merge: true }
    );
    playSfx(SFX_REDEEM);
    showToast("兌換成功！請找爸爸/媽媽領取 ✨", "success");
  } catch (e) {
    console.error(e);
    showToast(`兌換失敗: ${e?.message || e}`, "danger");
  }
}

initPage(renderShopContent, "shop");
