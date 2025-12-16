// js/shop.js

import { state, initPage, showToast, getKidDocRef, showModal, closeModal } from "./base.js"; 
import { updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/** 渲染獎勵商城 (Kid View) */
function renderShopContent() {
    const kidState = state.kidData[state.currentKidId] || { points: 0 };
    const currentPoints = kidState.points || 0;

    const rewardElements = state.rewards.map(reward => `
        <div class="bg-white p-5 rounded-3xl shadow-xl flex flex-col justify-between h-full border-4 border-pink-light/50 transition-all duration-300">
            <div class="text-center">
                <p class="text-4xl mb-3">🎁</p>
                <p class="text-xl font-black text-gray-800 mb-2">${reward.name}</p>
                <p class="text-sm text-gray-500 mb-4">${reward.description}</p>
            </div>
            <div class="mt-auto">
                <div class="flex items-center justify-center mb-3 p-2 bg-secondary/20 rounded-xl">
                    <span class="text-lg font-bold mr-2">兌換點數:</span>
                    <span class="text-secondary font-extrabold text-3xl">${reward.cost}</span>
                </div>
                <button 
                    onclick="redeemReward('${reward.id}', ${reward.cost})"
                    class="w-full py-3 rounded-2xl text-white font-black transition-colors shadow-lg
                    ${currentPoints >= reward.cost ? 'bg-accent hover:bg-teal-500 active:scale-95' : 'bg-gray-400 cursor-not-allowed'}"
                    ${currentPoints < reward.cost ? 'disabled' : ''}
                >
                    ${currentPoints >= reward.cost ? '兌換獎勵 ✨' : `還差 ${reward.cost - currentPoints} 點`}
                </button>
            </div>
        </div>
    `).join('');

    const viewContent = document.getElementById('view-content');
    if (!viewContent) return;

    viewContent.innerHTML = `
        <div class="text-center p-4 mb-8 rounded-3xl bg-primary shadow-2xl text-white border-4 border-indigo-600">
            <p class="text-xl font-bold">您的金幣餘額</p>
            <p class="text-6xl font-black text-secondary">${currentPoints}</p>
        </div>

        <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🛍️ 獎勵商城</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${rewardElements || '<div class="col-span-full text-center p-8 bg-gray-100 rounded-2xl text-gray-500 shadow-inner">家長還沒有設定獎勵商品喔！</div>'}
        </div>
    `;
}

/** 獎勵兌換 (導出給 HTML onclick 呼叫) */
window.redeemReward = async (rewardId, cost) => {
    if (!state.currentKidId) return showToast("請先選擇一位小朋友！", 'danger');

    const kidState = state.kidData[state.currentKidId];

    if ((kidState.points || 0) < cost) {
        return showToast("點數不足！請多努力完成任務！", 'danger');
    }

    const reward = state.rewards.find(r => r.id === rewardId);
    
    showModal(
        '確認兌換',
        `<p class="text-lg text-gray-700">您確定要用 <span class="text-secondary font-bold">${cost} 點</span> 兌換「${reward.name}」嗎？</p>`,
        `<button onclick="confirmRedemption('${rewardId}', ${cost})" class="px-4 py-2 bg-success text-white rounded-lg hover:bg-green-600">確定兌換</button>`
    );
};
window.redeemReward = window.redeemReward; 

/** 確認兌換 (導出給 Modal 呼叫) */
window.confirmRedemption = async (rewardId, cost) => {
    closeModal();
    const kidId = state.currentKidId;
    const kidRef = getKidDocRef(kidId);
    const kidState = state.kidData[kidId];

    try {
        await updateDoc(kidRef, {
            points: (kidState.points || 0) - cost,
            redemptions: arrayUnion({ rewardId, timestamp: Date.now(), cost })
        });

        showToast(`「${state.rewards.find(r => r.id === rewardId)?.name}」兌換成功！請找爸爸/媽媽領取！`, 'success');
    } catch (error) {
        console.error("Error redeeming reward:", error);
        showToast(`兌換失敗: ${error.message}`, 'danger');
    }
}
window.confirmRedemption = window.confirmRedemption; 

window.onload = () => {
    initPage(renderShopContent, 'shop');
};