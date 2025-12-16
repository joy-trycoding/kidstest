// js/settings.js

import { state, initPage, showToast, getKidCollectionRef, getKidDocRef, getTaskCollectionRef, getRewardCollectionRef, showModal, closeModal, switchKid } from "./base.js"; 
import { doc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/** 渲染任務清單子區塊 */
function renderTaskList() {
    const list = state.tasks.map(task => `
        <div class="flex items-center justify-between p-3 bg-bg-light rounded-xl shadow-inner mb-2 border border-gray-200">
            <div class="flex-1 min-w-0 mr-4">
                <p class="font-semibold text-gray-800 truncate">${task.name} <span class="text-xs text-primary ml-2">(${task.cycle === 'daily' ? '每日' : '一次性'})</span></p>
                <p class="text-sm text-gray-500">點數: ${task.points}</p>
            </div>
            <div class="flex space-x-2">
                <button onclick="showEditTaskModal('${task.id}')" class="text-primary hover:text-indigo-600 text-xl">📝</button>
                <button onclick="deleteItem('task', '${task.id}')" class="text-danger hover:text-red-600 text-xl">🗑️</button>
            </div>
        </div>
    `).join('');
    return list || '<p class="text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">目前沒有設定任何任務。</p>';
}

/** 渲染獎勵清單子區塊 */
function renderRewardList() {
    const list = state.rewards.map(reward => `
        <div class="flex items-center justify-between p-3 bg-bg-light rounded-xl shadow-inner mb-2 border border-gray-200">
            <div class="flex-1 min-w-0 mr-4">
                <p class="font-semibold text-gray-800 truncate">${reward.name}</p>
                <p class="text-sm text-gray-500">兌換點數: ${reward.cost}</p>
            </div>
            <div class="flex space-x-2">
                <button onclick="showEditRewardModal('${reward.id}')" class="text-primary hover:text-indigo-600 text-xl">📝</button>
                <button onclick="deleteItem('reward', '${reward.id}')" class="text-danger hover:text-red-600 text-xl">🗑️</button>
            </div>
        </div>
    `).join('');
    return list || '<p class="text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">目前沒有設定任何獎勵商品。</p>';
}

/** 渲染小朋友列表子區塊 */
function renderKidList(currentKid) {
    const list = state.kids.map(kid => `
        <div class="flex items-center justify-between p-3 bg-white rounded-xl shadow-md mb-2 border-2 ${kid.id === currentKid?.id ? 'border-primary ring-2 ring-primary/50' : 'border-gray-200'}">
            <div class="flex-1 min-w-0 mr-4">
                <p class="font-black text-gray-800 truncate">${kid.nickname} ${kid.id === currentKid?.id ? '(當前)' : ''}</p>
                <p class="text-xs text-gray-500">年齡: ${kid.age || '未填'} / 性別: ${kid.gender || '未填'}</p>
            </div>
            <div class="flex space-x-2">
                <button onclick="switchKid('${kid.id}')" class="text-accent hover:text-teal-600 text-xl">🔄</button>
                <button onclick="showEditKidModal('${kid.id}')" class="text-primary hover:text-indigo-600 text-xl">📝</button>
                <button onclick="deleteKid('${kid.id}')" class="text-danger hover:text-red-600 text-xl">🗑️</button>
            </div>
        </div>
    `).join('');
    
    return list || '<p class="text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">目前沒有設定任何小朋友。</p>';
}

/** 渲染設定頁面 (Parent View) */
function renderSettingsContent() {
    const currentKid = state.kids.find(k => k.id === state.currentKidId);
    const isInitialSetup = state.kids.length === 0;

    const viewContent = document.getElementById('view-content');
    if (!viewContent) return; 

    viewContent.innerHTML = `
        <div class="bg-white p-5 rounded-3xl shadow-xl border-4 border-primary/20 mb-6">
            <div class="flex justify-between items-center mb-6 border-b pb-3">
                <h2 class="text-2xl font-black text-primary">⚙️ 家長設定中心</h2>
            </div>
            
            ${!isInitialSetup ? `
                <h3 class="text-xl font-bold mb-3 mt-4 text-gray-800">✅ 任務清單管理</h3>
                <button onclick="showEditTaskModal()" class="w-full py-3 mb-4 bg-accent text-white font-black rounded-xl hover:bg-teal-500 transition-colors shadow-md">+ 新增任務</button>
                ${renderTaskList()}
            
                <h3 class="text-xl font-bold mb-3 mt-8 text-gray-800">🛍️ 獎勵商城編輯</h3>
                <button onclick="showEditRewardModal()" class="w-full py-3 mb-4 bg-accent text-white font-black rounded-xl hover:bg-teal-500 transition-colors shadow-md">+ 新增獎勵</button>
                ${renderRewardList()}
            ` : ''}
            
            <h3 class="text-xl font-bold mb-3 mt-8 text-gray-800">👨‍👩‍👧‍👦 小朋友資料設定</h3>
            
            <button onclick="showEditKidModal()" class="w-full py-3 mb-4 bg-pink-light text-white font-black rounded-xl hover:bg-orange-400 transition-colors shadow-md">+ 新增小朋友</button>

            ${renderKidList(currentKid)}
        </div>
    `;
}

// --- 管理操作函式 (確保 window.xxx 能夠被 HTML 調用) ---

// 小朋友管理
window.showEditKidModal = (kidId = null) => {
    const isEdit = !!kidId;
    const kid = isEdit ? state.kids.find(k => k.id === kidId) : {};
    const title = isEdit ? `編輯 ${kid.nickname}` : '新增小朋友資料';
    
    const contentHTML = `
        <label class="block mb-2 font-medium">暱稱 (必填)</label>
        <input type="text" id="kidNickname" value="${kid.nickname || ''}" class="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:border-accent focus:ring focus:ring-accent/50">
        
        <label class="block mb-2 font-medium">年齡</label>
        <input type="number" id="kidAge" value="${kid.age || ''}" class="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:border-accent focus:ring focus:ring-accent/50">
        
        <label class="block mb-2 font-medium">性別</label>
        <select id="kidGender" class="w-full p-3 border border-gray-300 rounded-xl focus:border-accent focus:ring focus:ring-accent/50">
            <option value="">請選擇</option>
            <option value="male" ${kid.gender === 'male' ? 'selected' : ''}>男生 👦</option>
            <option value="female" ${kid.gender === 'female' ? 'selected' : ''}>女生 👧</option>
        </select>
    `;

    // 關鍵修正：在新增模式下，傳遞 null 關鍵字 (不帶引號)，讓 JS 能夠解析
    const idForSave = isEdit ? `'${kidId}'` : 'null'; 
    
    // 使用 null 關鍵字，JS 會嘗試解析為 null，但 HTML 傳輸可能會轉為字串 "null"
    const saveButton = `
        <button onclick="saveKid(${idForSave})" class="px-4 py-2 bg-pink-light text-white rounded-lg font-bold hover:bg-orange-400">儲存</button>
    `;
    showModal(title, contentHTML, saveButton);
};
window.showEditKidModal = window.showEditKidModal;

window.saveKid = async (kidId = null) => {
    // 🌟 最終保險修正：將任何可能誤入的字串 "null" 或空字串轉為 null
    if (typeof kidId === 'string' && (kidId.toLowerCase() === 'null' || kidId.trim() === '')) {
        kidId = null;
    }
    
    const nickname = document.getElementById('kidNickname').value.trim();
    const age = document.getElementById('kidAge').value.trim();
    const gender = document.getElementById('kidGender').value;

    if (!nickname) return showToast("暱稱是必填項目！", 'danger');

    const data = { nickname, age: age ? parseInt(age) : null, gender };

    try {
        if (kidId) { 
            // 如果 kidId 是有效的 ID 字串，則執行更新
            await updateDoc(doc(getKidCollectionRef(), kidId), data);
            showToast('小朋友資料更新成功！');
        } else {
            // 如果 kidId 是 null，則執行新增
            await addDoc(getKidCollectionRef(), data);
            showToast('小朋友資料新增成功！');
        }
        closeModal();
    } catch (error) {
        console.error("Error saving kid:", error);
        showToast(`儲存失敗: ${error.message}`, 'danger');
    }
};
window.saveKid = window.saveKid;

window.deleteKid = async (kidId) => {
    const confirmed = confirm(`確定要刪除這位小朋友及其所有數據嗎？`);
    if (confirmed) {
        try {
            await deleteDoc(doc(getKidCollectionRef(), kidId));
            await deleteDoc(getKidDocRef(kidId));
            showToast('小朋友資料已刪除！');
            
            if (state.currentKidId === kidId) {
                state.currentKidId = state.kids.length > 0 ? state.kids[0].id : null;
            }
        } catch (error) {
            console.error("Error deleting kid:", error);
            showToast(`刪除失敗: ${error.message}`, 'danger');
        }
    }
};
window.deleteKid = window.deleteKid;

// 任務/獎勵的共用儲存和刪除函式
window.saveItem = async (type, data, itemId = null) => {
    // 🌟 最終保險修正：將任何可能誤入的字串 "null" 或空字串轉為 null
    if (typeof itemId === 'string' && (itemId.toLowerCase() === 'null' || itemId.trim() === '')) {
        itemId = null;
    }

    const colRef = type === 'task' ? getTaskCollectionRef() : getRewardCollectionRef();
    const collectionName = type === 'task' ? '任務' : '獎勵';

    if (type === 'task') {
         data.points = data.points ? parseInt(data.points) : data.points;
    }
    if (type === 'reward') {
         data.cost = data.cost ? parseInt(data.cost) : data.cost;
    }

    try {
        if (itemId) {
            await updateDoc(doc(colRef, itemId), data);
            showToast(`${collectionName}更新成功！`);
        } else {
            await addDoc(colRef, data);
            showToast(`${collectionName}新增成功！`);
        }
        closeModal();
    } catch (error) {
        console.error(`Error saving ${collectionName}:`, error);
        showToast(`儲存${collectionName}失敗: ${error.message}`, 'danger');
    }
};
window.saveItem = window.saveItem;

window.deleteItem = async (type, itemId) => {
    const colRef = type === 'task' ? getTaskCollectionRef() : getRewardCollectionRef();
    const collectionName = type === 'task' ? '任務' : '獎勵';
    const confirmed = confirm(`確定要刪除這個${collectionName}嗎？`);
    if (confirmed) {
        try {
            await deleteDoc(doc(colRef, itemId));
            showToast(`${collectionName}已刪除！`);
        } catch (error) {
            console.error(`Error deleting ${collectionName}:`, error);
            showToast(`刪除${collectionName}失敗: ${error.message}`, 'danger');
        }
    }
};
window.deleteItem = window.deleteItem;

// 任務管理
window.showEditTaskModal = (taskId = null) => {
    const isEdit = !!taskId;
    const task = isEdit ? state.tasks.find(t => t.id === taskId) : { cycle: 'daily', points: 10 };
    const title = isEdit ? `編輯任務: ${task.name}` : '新增任務';
    
    const contentHTML = `
        <label class="block mb-2 font-medium">任務名稱 (必填)</label>
        <input type="text" id="taskName" value="${task.name || ''}" class="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:border-accent focus:ring focus:ring-accent/50">
        
        <label class="block mb-2 font-medium">任務說明</label>
        <textarea id="taskDescription" class="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:border-accent focus:ring focus:ring-accent/50">${task.description || ''}</textarea>
        
        <label class="block mb-2 font-medium">獎勵點數 (必填)</label>
        <input type="number" id="taskPoints" value="${task.points || ''}" class="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:border-accent focus:ring focus:ring-accent/50">
        
        <label class="block mb-2 font-medium">任務週期</label>
        <select id="taskCycle" class="w-full p-3 border border-gray-300 rounded-xl focus:border-accent focus:ring focus:ring-accent/50">
            <option value="daily" ${task.cycle === 'daily' ? 'selected' : ''}>每日任務</option>
            <option value="once" ${task.cycle === 'once' ? 'selected' : ''}>一次性任務</option>
            <option value="weekly" ${task.cycle === 'weekly' ? 'selected' : ''}>每週任務 (暫不支持複雜日期)</option>
        </select>
    `;

    // 關鍵修正：在新增模式下，傳遞 null 關鍵字
    const idForSave = isEdit ? `'${taskId}'` : 'null'; 

    const saveButton = `
        <button onclick="saveTaskForm(${idForSave})" class="px-4 py-2 bg-accent text-white rounded-lg font-bold hover:bg-teal-500">儲存</button>
    `;
    showModal(title, contentHTML, saveButton);
};
window.showEditTaskModal = window.showEditTaskModal;

window.saveTaskForm = (taskId) => {
    const data = {
        name: document.getElementById('taskName').value.trim(),
        description: document.getElementById('taskDescription').value.trim(),
        points: document.getElementById('taskPoints').value.trim(),
        cycle: document.getElementById('taskCycle').value,
    };
    if (!data.name || !data.points) return showToast("任務名稱和點數是必填項！", 'danger');
    window.saveItem('task', data, taskId);
};
window.saveTaskForm = window.saveTaskForm;

// 獎勵管理
window.showEditRewardModal = (rewardId = null) => {
    const isEdit = !!rewardId;
    const reward = isEdit ? state.rewards.find(r => r.id === rewardId) : { cost: 100 };
    const title = isEdit ? `編輯獎勵: ${reward.name}` : '新增獎勵商品';
    
    const contentHTML = `
        <label class="block mb-2 font-medium">商品名稱 (必填)</label>
        <input type="text" id="rewardName" value="${reward.name || ''}" class="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:border-accent focus:ring focus:ring-accent/50">
        
        <label class="block mb-2 font-medium">商品說明</label>
        <textarea id="rewardDescription" class="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:border-accent focus:ring focus:ring-accent/50">${reward.description || ''}</textarea>
        
        <label class="block mb-2 font-medium">兌換點數 (必填)</label>
        <input type="number" id="rewardCost" value="${reward.cost || ''}" class="w-full p-3 border border-gray-300 rounded-xl mb-4 focus:border-accent focus:ring focus:ring-accent/50">
    `;

    // 關鍵修正：在新增模式下，傳遞 null 關鍵字
    const idForSave = isEdit ? `'${rewardId}'` : 'null'; 

    const saveButton = `
        <button onclick="saveRewardForm(${idForSave})" class="px-4 py-2 bg-accent text-white rounded-lg font-bold hover:bg-teal-500">儲存</button>
    `;
    showModal(title, contentHTML, saveButton);
};
window.showEditRewardModal = window.showEditRewardModal;

window.saveRewardForm = (rewardId) => {
    const data = {
        name: document.getElementById('rewardName').value.trim(),
        description: document.getElementById('rewardDescription').value.trim(),
        cost: document.getElementById('rewardCost').value.trim(),
    };
    if (!data.name || !data.cost) return showToast("商品名稱和點數是必填項！", 'danger');
    window.saveItem('reward', data, rewardId);
};
window.saveRewardForm = window.saveRewardForm;


// 啟動邏輯
initPage(renderSettingsContent, 'settings');
