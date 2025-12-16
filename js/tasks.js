// js/tasks.js

import { state, initPage, showToast, getKidDocRef } from "./base.js"; 
import { updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/** 渲染任務牆 (Tasks View) */
function renderTasksContent() {
    const currentKid = state.kids.find(k => k.id === state.currentKidId);
    const kidState = state.kidData[state.currentKidId] || { points: 0, lastTaskCompletion: {} };
    const today = new Date().toDateString();

    const taskElements = state.tasks
        .filter(task => {
            if (task.cycle === 'daily') {
                const lastCompletionDate = kidState.lastTaskCompletion[task.id] ? new Date(kidState.lastTaskCompletion[task.id]).toDateString() : null;
                return lastCompletionDate !== today;
            }
            return true; 
        })
        .map(task => `
            <div class="flex items-center justify-between bg-white p-4 rounded-2xl shadow-lg mb-4 border-b-4 border-accent">
                <div class="flex-1 min-w-0 mr-4">
                    <p class="font-black text-xl text-primary truncate">${task.name}</p>
                    <p class="text-sm text-gray-500 mt-1">${task.description}</p>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="text-secondary font-extrabold text-2xl whitespace-nowrap">+${task.points}</span>
                    <button onclick="completeTask('${task.id}', ${task.points})" class="flex items-center justify-center w-12 h-12 bg-success text-white rounded-full shadow-2xl hover:bg-green-600 transition-transform active:scale-95 transform duration-150">
                        <span class="text-2xl">🎉</span>
                    </button>
                </div>
            </div>
        `).join('');

    const kidNickname = currentKid?.nickname || '小朋友';

    const viewContent = document.getElementById('view-content');
    if (!viewContent) return; 
    
    viewContent.innerHTML = `
        <h2 class="text-2xl font-extrabold text-gray-800 mb-2">${kidNickname} 的點數狀況</h2>
        <div class="text-center p-6 mb-8 rounded-3xl bg-secondary shadow-2xl text-white points-pulse border-4 border-yellow-300">
            <p class="text-lg font-bold">累積金幣</p>
            <p class="text-7xl font-black">${kidState.points || 0}</p>
            <p class="text-3xl font-bold">點</p>
        </div>

        <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌟 今日待辦任務</h2>
        ${taskElements || '<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">太棒了！所有的任務都完成了，可以去領獎勵囉！</div>'}
    `;
}

/** 任務完成 (導出給 HTML onclick 呼叫) */
window.completeTask = async (taskId, points) => {
    if (!state.currentKidId) return showToast("請先選擇一位小朋友！", 'danger');
    
    const kidId = state.currentKidId;
    const kidRef = getKidDocRef(kidId);
    const now = Date.now();
    const today = new Date().toDateString();

    try {
        const task = state.tasks.find(t => t.id === taskId);
        const kidState = state.kidData[kidId];

        if (task.cycle === 'daily') {
            const lastCompletionDate = kidState.lastTaskCompletion[taskId] ? new Date(kidState.lastTaskCompletion[taskId]).toDateString() : null;
            if (lastCompletionDate === today) {
                return showToast("這個每日任務今天已經完成了喔！", 'info');
            }
        }

        await updateDoc(kidRef, {
            points: (kidState.points || 0) + points,
            [`lastTaskCompletion.${taskId}`]: now,
        });

        showToast(`任務完成！獲得 ${points} 點！`, 'success');
        
        const newPoints = (kidState.points || 0) + points;
        if (Math.floor(newPoints / 50) > Math.floor(kidState.points / 50)) {
            showToast("恭喜！您獲得了一顆精靈蛋！🥚", 'success');
        }

        // base.js 的監聽器會自動觸發 renderTasksContent
    } catch (error) {
        console.error("Error completing task:", error);
        showToast(`完成任務失敗: ${error.message}`, 'danger');
    }
};


window.onload = () => {
    initPage(renderTasksContent, 'tasks');
};