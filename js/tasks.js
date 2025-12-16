// js/tasks.js

// 確保匯入了 setDoc (假設 base.js 已經匯出了它)
import { getKidStateDocRef, state, showToast, showModal, initPage, setDoc, doc } from "./base.js"; 
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
        <div class="p-4 bg-white rounded-xl shadow-md mb-6">
            <p class="text-lg font-bold text-gray-800">當前小朋友：${kidNickname}</p>
            <p class="text-xl font-extrabold text-secondary mt-1">點數: ${kidState.points || 0}</p>
        </div>

        <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌟 今日待辦任務</h2>
        ${taskElements || '<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">太棒了！所有的任務都完成了，可以去領獎勵囉！</div>'}
    `;
}

/** 任務完成 (導出給 HTML onclick 呼叫) */
window.completeTask = async (taskId, points) => {
    if (!state.currentKidId) return showToast("請先選擇一位小朋友！", 'danger');
    
    const kidId = state.currentKidId;
    const kidRef = getKidStateDocRef(kidId); 
    
    const now = Date.now();
    const today = new Date().toDateString();

    try {
        const task = state.tasks.find(t => t.id === taskId);
        const kidState = state.kidData[kidId] || { points: 0, lastTaskCompletion: {} }; // 確保 kidState 有默認值

        if (task.cycle === 'daily') {
            const lastCompletionDate = kidState.lastTaskCompletion[taskId] ? new Date(kidState.lastTaskCompletion[taskId]).toDateString() : null;
            if (lastCompletionDate === today) {
                return showToast("這個每日任務今天已經完成了喔！", 'info');
            }
        }

        // 🌟 關鍵修正：使用 setDoc with merge: true，確保文件不存在時能創建，存在時能更新
        await setDoc(kidRef, {
            points: (kidState.points || 0) + points,
            lastTaskCompletion: {
                ...kidState.lastTaskCompletion,
                [taskId]: now,
            }
        }, { merge: true });

        showToast(`任務完成！獲得 ${points} 點！`, 'success');
        
        const newPoints = (kidState.points || 0) + points;
        if (Math.floor(newPoints / 50) > Math.floor(kidState.points / 50)) {
            showToast("恭喜！您獲得了一顆精靈蛋！🥚", 'success');
        }

    } catch (error) {
        console.error("Error completing task:", error);
        // 打印更詳細的錯誤信息
        if (error.code === 'permission-denied') {
             showToast("任務失敗：權限不足。請檢查 Firebase 安全規則。", 'danger');
        } else {
             showToast(`完成任務失敗: ${error.message}`, 'danger');
        }
    }
};
// 確保全域可訪問
window.completeTask = window.completeTask; 

// 啟動邏輯
initPage(renderTasksContent, 'tasks');
