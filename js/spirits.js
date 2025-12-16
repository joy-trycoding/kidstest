// js/spirits.js

import { state, initPage, showToast, getKidDocRef, showModal, closeModal } from "./base.js";
import { updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/** 取得隨機精靈資料 */
function getRandomSpirit() {
    const spirits = [
        { name: "火焰小精靈", icon: "🔥" },
        { name: "水滴小精靈", icon: "💧" },
        { name: "大地小精靈", icon: "🌿" },
        { name: "閃電小精精", icon: "⚡" },
        { name: "彩虹小精靈", icon: "🌈" },
        { name: "月光小精靈", icon: "🌙" },
    ];
    return spirits[Math.floor(Math.random() * spirits.length)];
}

/** 渲染精靈蛋屋 (Kid View) */
function renderSpiritsContent() {
    const kidState = state.kidData[state.currentKidId] || { points: 0, spirits: [] };
    const currentPoints = kidState.points || 0;
    const pointsNeeded = 50;
    const numEggs = Math.floor(currentPoints / pointsNeeded);

    const successfulSpirits = kidState.spirits.filter(s => s.isSuccess);
    const failedSpirits = kidState.spirits.filter(s => !s.isSuccess);

    const viewContent = document.getElementById('view-content');
    if (!viewContent) return;

    viewContent.innerHTML = `
        <div class="text-center p-6 mb-8 rounded-3xl bg-pink-light shadow-2xl text-primary border-4 border-red-300">
            <p class="text-xl font-bold">您有</p>
            <p class="text-7xl font-black text-white">${numEggs}</p>
            <p class="text-2xl font-bold">顆精靈蛋可孵化！</p>
            <button 
                onclick="hatchSpirit()"
                class="mt-4 px-6 py-3 rounded-full font-black text-lg transition-colors shadow-2xl
                ${numEggs >= 1 ? 'bg-secondary text-primary hover:bg-yellow-500 egg-hatch-animation active:scale-90' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}"
                ${numEggs < 1 ? 'disabled' : ''}
            >
                ${numEggs >= 1 ? '💖 點擊孵化魔法蛋' : `累積 ${pointsNeeded} 點可獲得下一顆蛋`}
            </button>
        </div>

        <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌈 我的精靈收藏 (${successfulSpirits.length})</h2>
        <div class="grid grid-cols-3 gap-4 mb-8">
            ${successfulSpirits.map(s => `
                <div class="text-center p-4 bg-white rounded-2xl shadow-md border-2 border-accent/50">
                    <p class="text-5xl">${s.icon}</p>
                    <p class="text-sm font-black truncate text-primary mt-1">${s.customName || s.name}</p>
                    <p class="text-xs text-gray-500">${s.customName ? s.name : '未命名'}</p>
                </div>
            `).join('') || '<div class="col-span-3 text-center p-6 bg-gray-100 rounded-2xl text-gray-500">還沒有成功孵化的精靈喔！</div>'}
        </div>

        <h2 class="text-2xl font-extrabold text-gray-800 mb-4">💔 孵化紀錄</h2>
        <div class="flex items-center space-x-4 bg-white p-4 rounded-2xl shadow-md border-2 border-danger/50">
            <span class="text-4xl text-danger">💔</span>
            <div>
                <p class="font-bold text-lg">未成功孵化 (碎蛋)</p>
                <p class="text-3xl font-bold text-danger">${failedSpirits.length}</p>
            </div>
        </div>
    `;
}

/** 孵化精靈 (導出給 HTML onclick 呼叫) */
window.hatchSpirit = async () => {
    if (!state.currentKidId) return showToast("請先選擇一位小朋友！", 'danger');
    
    const kidId = state.currentKidId;
    const kidRef = getKidDocRef(kidId);
    const kidState = state.kidData[kidId];

    const pointsNeeded = 50;
    const numEggs = Math.floor((kidState.points || 0) / pointsNeeded);

    if (numEggs < 1) {
        return showToast(`點數不足！每 ${pointsNeeded} 點可孵化一顆蛋。`, 'info');
    }

    const pointsToDeduct = pointsNeeded;
    const newPoints = (kidState.points || 0) - pointsToDeduct;

    const isSuccess = Math.random() < 0.9;
    const newSpirit = {
        id: crypto.randomUUID(),
        isSuccess: isSuccess,
        timestamp: Date.now(),
        ...getRandomSpirit(),
        customName: isSuccess ? '' : '碎裂的蛋殼'
    };

    try {
        await updateDoc(kidRef, {
            points: newPoints,
            spirits: arrayUnion(newSpirit)
        });
        
        if (isSuccess) {
            showModal(
                '🥚 孵化成功！',
                `<div class="text-center">
                    <p class="text-6xl mb-4">${newSpirit.icon}</p>
                    <p class="text-xl font-semibold mb-3">恭喜您孵化出「${newSpirit.name}」！</p>
                    <label for="customName" class="block text-gray-700">為牠取個可愛的名字吧：</label>
                    <input type="text" id="customName" placeholder="輸入名字" class="w-full mt-1 p-2 border border-gray-300 rounded-lg">
                </div>`,
                `確定命名`,
                // 將命名邏輯直接放入 onConfirm 回呼中
                () => nameSpirit(newSpirit.id)
            );
        } else {
            showModal(
                '💔 孵化失敗...',
                `<div class="text-center">
                    <p class="text-6xl mb-4">💔</p>
                    <p class="text-xl font-semibold text-danger">哎呀！這次沒有成功孵化。</p>
                    <p class="text-gray-600 mt-2">別灰心，再努力累積點數吧！</p>
                </div>`,
                `我知道了`,
                closeModal
            );
        }
    } catch (error) {
        console.error("Error hatching spirit:", error);
        showToast(`孵化失敗: ${error.message}`, 'danger');
    }
};
window.hatchSpirit = window.hatchSpirit; 

/** 命名精靈 (導出給 Modal 呼叫) */
const nameSpirit = async (spiritId) => {
    const customName = document.getElementById('customName').value.trim();
    if (!customName) {
        return showToast("名字不能為空！", 'danger');
    }

    const kidId = state.currentKidId;
    const kidRef = getKidDocRef(kidId);
    const kidState = state.kidData[kidId];

    try {
        const updatedSpirits = kidState.spirits.map(s => 
            s.id === spiritId ? { ...s, customName: customName } : s
        );
        
        await updateDoc(kidRef, { spirits: updatedSpirits });
        showToast(`精靈已命名為「${customName}」！`, 'success');
        closeModal();
    } catch (error) {
        console.error("Error naming spirit:", error);
        showToast(`命名失敗: ${error.message}`, 'danger');
    }
};
window.nameSpirit = nameSpirit;

// 🚨 關鍵修正：移除 window.onload，在模組載入時直接啟動
initPage(renderSpiritsContent, 'spirits');