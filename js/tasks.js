// js/tasks.js (防重複、語音新增)

import { getKidStateDocRef, state, showToast, initPage, setDoc, speakText, stopSpeaking } from "./base.js"; 
import { arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

/** 朗讀任務標題和內容 */
window.readTaskDescription = (title, description) => {
    stopSpeaking(); // 確保停止當前語音
    const textToRead = `任務標題：${title}。任務內容：${description}`;
    speakText(textToRead);
};
window.readTaskDescription = window.readTaskDescription;

/** 渲染任務牆 (Tasks View) */
function renderTasksContent() {
    const viewContent = document.getElementById("view-content");
    if (!viewContent) return;

    const kidId = state.currentKidId;
    const currentKid = (state.kids || []).find((k) => k.id === kidId) || null;

    // 確保本地默認值
    const kidState = (state.kidData && kidId && state.kidData[kidId]) ? state.kidData[kidId] : { points: 0, lastTaskCompletion: {} };
    const lastCompletion = kidState.lastTaskCompletion || {};

    const todayStr = new Date().toDateString();

    const taskElements = (state.tasks || [])
        .map((task) => {
            if (!task) return '';
            
            let isCompletedToday = false;
            let completionStatus = '';
            let buttonHtml;

            if (task.cycle === "daily") {
                const ts = lastCompletion[task.id];
                const lastDate = ts ? new Date(ts).toDateString() : null;
                isCompletedToday = lastDate === todayStr;
                completionStatus = isCompletedToday ? 'bg-gray-200 border-success/50 text-success' : 'bg-white border-accent';
            }

            if (isCompletedToday) {
                // 任務已完成，顯示禁用狀態
                buttonHtml = `
                    <div class="flex items-center justify-center w-12 h-12 bg-success/50 text-white rounded-full shadow-2xl">
                        <span class="text-2xl">✅</span>
                    </div>
                `;
            } else {
                // 任務未完成，顯示可點擊按鈕
                buttonHtml = `
                    <button onclick="window.completeTask('${task.id}', ${Number(task.points ?? 0)})"
                        class="flex items-center justify-center w-12 h-12 bg-success text-white rounded-full shadow-2xl hover:bg-green-600 transition-transform active:scale-95 transform duration-150"
                        aria-label="完成任務">
                        <span class="text-2xl">🎉</span>
                    </button>
                `;
            }

            // 組裝任務卡片 HTML
            return `
                <div class="flex items-center justify-between p-4 rounded-2xl shadow-lg mb-4 border-b-4 ${completionStatus}">
                    <div class="flex-1 min-w-0 mr-4">
                        <div class="flex items-center space-x-2 mb-1">
                            <p class="font-black text-xl text-primary truncate ${isCompletedToday ? 'line-through text-gray-500' : ''}">
                                ${escapeHtml(task.name || "")}
                            </p>
                            <button onclick="window.readTaskDescription('${escapeHtml(task.name || "")}', '${escapeHtml(task.description || "")}')" class="text-blue-500 hover:text-blue-700 transition duration-150">
                                <span class="text-lg">🔊</span>
                            </button>
                        </div>
                        <p class="text-sm text-gray-500 mt-1">${escapeHtml(task.description || "")}</p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="text-secondary font-extrabold text-2xl whitespace-nowrap">+${Number(task.points ?? 0)}</span>
                        ${buttonHtml}
                    </div>
                </div>
            `;
        })
        .join("");

    const kidNickname = currentKid?.nickname || "小朋友";

    viewContent.innerHTML = `
        <div class="p-4 bg-white rounded-xl shadow-md mb-6">
            <p class="text-lg font-bold text-gray-800">當前小朋友：${escapeHtml(kidNickname)}</p>
            <p class="text-xl font-extrabold text-secondary mt-1">點數: ${Number(kidState.points ?? 0)}</p>
        </div>

        <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌟 今日任務牆</h2>
        ${
            taskElements ||
            '<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">家長還沒有設定任何任務喔！</div>'
        }
    `;
}

/** Complete a task (called from onclick) */
window.completeTask = async (taskId, points) => {
    const kidId = state.currentKidId;
    if (!kidId) {
        showToast("請先選擇一位小朋友！", "danger");
        return;
    }

    const task = (state.tasks || []).find((t) => t && t.id === taskId);
    if (!task) {
        showToast("任務資料遺失，請重新整理頁面。", "danger");
        console.error("Attempted to complete non-existent task:", taskId);
        return;
    }

    // 確保本地默認值
    if (!state.kidData) state.kidData = {};
    const kidState = state.kidData[kidId] || { points: 0, lastTaskCompletion: {} };
    const lastCompletion = kidState.lastTaskCompletion || {};

    const now = Date.now();
    const todayStr = new Date().toDateString();

    // Prevent double completion for daily tasks (client-side guard)
    if (task.cycle === "daily") {
        const ts = lastCompletion[taskId];
        const lastDate = ts ? new Date(ts).toDateString() : null;
        if (lastDate === todayStr) {
            showToast("這個每日任務今天已經完成了喔！", "info");
            return;
        }
    }

    const addPoints = Number(points ?? 0) || 0;
    const newPoints = Number(kidState.points ?? 0) + addPoints;

    try {
        const kidRef = getKidStateDocRef(kidId);

        // 使用 setDoc with merge: true，確保文件不存在時能創建，存在時能更新
        await setDoc(
            kidRef,
            {
                points: newPoints,
                lastTaskCompletion: {
                    ...lastCompletion,
                    [taskId]: now,
                },
            },
            { merge: true }
        );

        // Sync local state (Optimistic UI)
        state.kidData[kidId] = {
            ...kidState,
            points: newPoints,
            lastTaskCompletion: {
                ...lastCompletion,
                [taskId]: now,
            },
        };

        showToast(`任務完成！獲得 ${addPoints} 點！`, "success");

        // 檢查精靈蛋里程碑
        if (Math.floor(newPoints / 50) > Math.floor(Number(kidState.points ?? 0) / 50)) {
            showToast("恭喜！您獲得了一顆精靈蛋！🥚", "success");
        }

        // 重新渲染，立刻反映完成狀態和 Header 點數
        renderTasksContent(); 
    } catch (error) {
        console.error("Error completing task:", error);
        if (error?.code === "permission-denied") {
            showToast("任務失敗：權限不足。請檢查 Firebase 安全規則。", "danger");
        } else {
            showToast(`完成任務失敗: ${error?.message || error}`, "danger");
        }
    }
};
window.completeTask = window.completeTask;

// Bootstrap
initPage(renderTasksContent, "tasks");