import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, writeBatch, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 設定 Firebase Debug Log
setLogLevel('Debug');

// --- Global Constants and Configuration ---
const appId = 'autonomy-helper-mock-id';
const initialAuthToken = null; 

const MOCK_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDZ6A9haTwY6dCa93Tsa1X63ehzx-xe_FE", 
    authDomain: "kidstest-99c7f.firebaseapp.com",
    projectId: "kidstest-99c7f", 
    storageBucket: "kidstest-99c7f.firebasestorage.app", 
    messagingSenderId: "4719977826", 
    appId: "1:4719977826:web:e002e7b9b2036d3b39383b",
    measurementId: "G-Z6VT9G5JR9"
};

const firebaseConfig = MOCK_FIREBASE_CONFIG; 

let app;
let db;
let auth;
let userId = null;

// --- App State ---
const state = {
    isAuthReady: false,
    currentView: 'settings', 
    kids: [],
    currentKidId: null,
    tasks: [],
    rewards: [],
    kidData: {}, 
    modalOpen: false,
    toastQueue: [],
};

// --- Firestore Paths ---
const getKidCollectionRef = () => collection(db, `artifacts/${appId}/users/${userId}/kids`);
const getTaskCollectionRef = () => collection(db, `artifacts/${appId}/users/${userId}/tasks`);
const getRewardCollectionRef = () => collection(db, `artifacts/${appId}/users/${userId}/rewards`);
const getKidDocRef = (kidId) => doc(db, `artifacts/${appId}/users/${userId}/kid_state/${kidId}`);

// --- Data Preload ---
const initialTasks = [
    { name: "準時上床", description: "晚上 9 點前刷牙換睡衣並躺在床上。", points: 10, cycle: "daily" },
    { name: "整理玩具", description: "自己將玩完的玩具物歸原位。", points: 15, cycle: "daily" },
    { name: "協助家務", description: "幫忙把洗好的衣服拿到房間放好。", points: 30, cycle: "once" },
    { name: "閱讀時光", description: "每天至少閱讀一本書 15 分鐘。", points: 10, cycle: "daily" },
    { name: "禮貌表達", description: "對長輩說「請、謝謝、對不起」。", points: 5, cycle: "daily" }
];

const initialRewards = [
    { name: "週末甜點", description: "換取一次晚餐後的冰淇淋或小蛋糕。", cost: 150 },
    { name: "多玩 30 分鐘", description: "換取額外 30 分鐘看電視或玩遊戲時間。", cost: 200 },
    { name: "玩具購物券", description: "可兌換一張 100 元的玩具購物券。", cost: 500 },
    { name: "睡前故事", description: "讓爸爸/媽媽多講一個睡前故事。", cost: 80 },
    { name: "戶外活動", description: "週末全家去公園或郊遊一次。", cost: 400 }
];


// --- RENDER FUNCTION DEFINITIONS ---

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

/** 渲染小朋友列表子區塊 (在設定頁面使用) */
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

/** 渲染任務牆 (Kid View) */
function renderTasks() {
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

    const element = document.createElement('div');
    element.innerHTML = `
        <h2 class="text-2xl font-extrabold text-gray-800 mb-2">${kidNickname} 的點數狀況</h2>
        <div class="text-center p-6 mb-8 rounded-3xl bg-secondary shadow-2xl text-white points-pulse border-4 border-yellow-300">
            <p class="text-lg font-bold">累積金幣</p>
            <p class="text-7xl font-black">${kidState.points || 0}</p>
            <p class="text-3xl font-bold">點</p>
        </div>

        <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🌟 今日待辦任務</h2>
        ${taskElements || '<div class="text-center p-8 bg-accent/20 rounded-2xl text-accent font-bold shadow-inner">太棒了！所有的任務都完成了，可以去領獎勵囉！</div>'}
    `;
    return element;
}

/** 渲染獎勵商城 (Kid View) */
function renderShop() {
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

    const element = document.createElement('div');
    element.innerHTML = `
        <div class="text-center p-4 mb-8 rounded-3xl bg-primary shadow-2xl text-white border-4 border-indigo-600">
            <p class="text-xl font-bold">您的金幣餘額</p>
            <p class="text-6xl font-black text-secondary">${currentPoints}</p>
        </div>

        <h2 class="text-2xl font-extrabold text-gray-800 mb-4">🛍️ 獎勵商城</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${rewardElements || '<div class="col-span-full text-center p-8 bg-gray-100 rounded-2xl text-gray-500 shadow-inner">家長還沒有設定獎勵商品喔！</div>'}
        </div>
    `;
    return element;
}

/** 渲染精靈蛋屋 (Kid View) */
function renderSpirits() {
    const kidState = state.kidData[state.currentKidId] || { points: 0, spirits: [] };
    const currentPoints = kidState.points || 0;
    const pointsNeeded = 50;
    const numEggs = Math.floor(currentPoints / pointsNeeded);

    const successfulSpirits = kidState.spirits.filter(s => s.isSuccess);
    const failedSpirits = kidState.spirits.filter(s => !s.isSuccess);

    const element = document.createElement('div');
    element.innerHTML = `
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
    return element;
}

/** 渲染設定頁面 (Parent View) */
function renderSettings(forceKidSetup = false) {
    const currentKid = state.kids.find(k => k.id === state.currentKidId);
    
    const element = document.createElement('div');
    element.innerHTML = `
        <div class="bg-white p-5 rounded-3xl shadow-xl border-4 border-primary/20 mb-6">
            <div class="flex justify-between items-center mb-6 border-b pb-3">
                <h2 class="text-2xl font-black text-primary">⚙️ 家長設定中心</h2>
                <span class="text-xs text-gray-500">UID: ${userId ? userId.substring(0, 8) + '...' : '未認證'}</span>
            </div>
            
            ${!forceKidSetup ? `
                <h3 class="text-xl font-bold mb-3 mt-4 text-gray-800">✅ 任務清單管理</h3>
                <button onclick="showEditTaskModal()" class="w-full py-3 mb-4 bg-accent text-white font-black rounded-xl hover:bg-teal-500 transition-colors shadow-md">+ 新增任務</button>
                ${renderTaskList()}
            
                <h3 class="text-xl font-bold mb-3 mt-8 text-gray-800">🛍️ 獎勵商城編輯</h3>
                <button onclick="showEditRewardModal()" class="w-full py-3 mb-4 bg-accent text-white font-black rounded-xl hover:bg-teal-500 transition-colors shadow-md">+ 新增獎勵</button>
                ${renderRewardList()}
            ` : ''}
            
            <h3 class="text-xl font-bold mb-3 mt-8 text-gray-800">👨‍👩‍👧‍👦 小朋友資料設定</h3>
            
            <!-- 修正：將新增小朋友按鈕移到主要區塊外，確保即使是初始設定模式也能看到 -->
            <button onclick="showEditKidModal()" class="w-full py-3 mb-4 bg-pink-light text-white font-black rounded-xl hover:bg-orange-400 transition-colors shadow-md">+ 新增小朋友</button>

            ${renderKidList(currentKid)}
        </div>
    `;
    return element;
}


// --- CORE LOGIC FUNCTIONS ---

/** 顯示 Toast 訊息 */
window.showToast = (message, type = 'success') => {
    const toastContainer = document.getElementById('toast-container');
    const color = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : 'bg-primary';
    const icon = type === 'success' ? '✔️' : type === 'danger' ? '❌' : 'ℹ️';

    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-xl text-white font-medium flex items-center space-x-2 ${color} transition-all duration-300 transform translate-x-full opacity-0`;
    toast.innerHTML = `<span>${icon}</span><span class="whitespace-nowrap">${message}</span>`;
    
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    }, 50);

    setTimeout(() => {
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('translate-x-full', 'opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
};

/** 顯示 Modal */
window.showModal = (title, contentHTML, buttonsHTML = '') => {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return; 

    state.modalOpen = true;
    modalContent.innerHTML = `
        <h3 class="text-2xl font-bold mb-4 text-primary">${title}</h3>
        <div class="space-y-4">
            ${contentHTML}
        </div>
        <div class="mt-6 flex justify-end space-x-3">
            <button onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
            ${buttonsHTML}
        </div>
    `;
    document.getElementById('modal-container').classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 50);
};

/** 關閉 Modal */
window.closeModal = () => {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    modalContent.addEventListener('transitionend', () => {
        document.getElementById('modal-container').classList.add('hidden');
        state.modalOpen = false;
    }, { once: true });
};


/** 切換當前小朋友 */
window.switchKid = (kidId) => {
    state.currentKidId = kidId;
    localStorage.setItem('currentKidId', kidId);
    render();
    showToast(`已切換至 ${state.kids.find(k => k.id === kidId)?.nickname || '新小朋友'}`, 'info');
};

/** 切換 View */
window.changeView = (view) => {
    state.currentView = view;
    console.log(`[App] Switching view to: ${view}`);
    try {
        render();
    } catch(e) {
        console.error("Render failed during view change:", e);
        showToast("頁面切換失敗，請檢查 Console 錯誤", 'danger');
    }
};

/** 任務完成 */
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

        render();
    } catch (error) {
        console.error("Error completing task:", error);
        showToast(`完成任務失敗: ${error.message}`, 'danger');
    }
};

/** 獎勵兌換 */
window.redeemReward = async (rewardId, cost) => {
    if (!state.currentKidId) return showToast("請先選擇一位小朋友！", 'danger');

    const kidId = state.currentKidId;
    const kidRef = getKidDocRef(kidId);
    const kidState = state.kidData[kidId];

    if ((kidState.points || 0) < cost) {
        return showToast("點數不足！請多努力完成任務！", 'danger');
    }

    const reward = state.rewards.find(r => r.id === rewardId);
    
    window.showModal(
        '確認兌換',
        `<p class="text-lg text-gray-700">您確定要用 <span class="text-secondary font-bold">${cost} 點</span> 兌換「${reward.name}」嗎？</p>`,
        `<button onclick="confirmRedemption('${rewardId}', ${cost})" class="px-4 py-2 bg-success text-white rounded-lg hover:bg-green-600">確定兌換</button>`
    );
};

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
        render();
    } catch (error) {
        console.error("Error redeeming reward:", error);
        showToast(`兌換失敗: ${error.message}`, 'danger');
    }
}

/** 孵化精靈 */
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
            window.showModal(
                '🥚 孵化成功！',
                `<div class="text-center">
                    <p class="text-6xl mb-4">${newSpirit.icon}</p>
                    <p class="text-xl font-semibold mb-3">恭喜您孵化出「${newSpirit.name}」！</p>
                    <label for="customName" class="block text-gray-700">為牠取個可愛的名字吧：</label>
                    <input type="text" id="customName" placeholder="輸入名字" class="w-full mt-1 p-2 border border-gray-300 rounded-lg">
                </div>`,
                `<button onclick="nameSpirit('${newSpirit.id}')" class="px-4 py-2 bg-success text-white rounded-lg hover:bg-green-600">確定命名</button>`
            );
        } else {
            window.showModal(
                '💔 孵化失敗...',
                `<div class="text-center">
                    <p class="text-6xl mb-4">💔</p>
                    <p class="text-xl font-semibold text-danger">哎呀！這次沒有成功孵化。</p>
                    <p class="text-gray-600 mt-2">別灰心，再努力累積點數吧！</p>
                </div>`,
                `<button onclick="closeModal()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-600">我知道了</button>`
            );
        }
        render();
    } catch (error) {
        console.error("Error hatching spirit:", error);
        showToast(`孵化失敗: ${error.message}`, 'danger');
    }
};

/** 命名精靈 */
window.nameSpirit = async (spiritId) => {
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
        render();
    } catch (error) {
        console.error("Error naming spirit:", error);
        showToast(`命名失敗: ${error.message}`, 'danger');
    }
};

/** 顯示小朋友切換 Modal */
window.showKidSwitchModal = () => {
    const contentHTML = state.kids.map(kid => `
        <button onclick="switchKidAndCloseModal('${kid.id}')" class="w-full text-left p-4 rounded-xl border-2 transition-all ${kid.id === state.currentKidId ? 'bg-primary text-white border-primary shadow-lg' : 'bg-bg-light hover:bg-gray-100 border-gray-200'}">
            <span class="font-bold text-lg">${kid.nickname}</span> ${kid.id === state.currentKidId ? ' (當前 👑)' : ''}
        </button>
    `).join('');

    showModal('切換小朋友', contentHTML);
}

/** 切換小朋友並關閉 Modal */
window.switchKidAndCloseModal = (kidId) => {
    switchKid(kidId);
    closeModal();
}

/** 顯示編輯小朋友 Modal */
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

    const saveButton = `
        <button onclick="saveKid('${kidId}')" class="px-4 py-2 bg-pink-light text-white rounded-lg font-bold hover:bg-orange-400">儲存</button>
    `;
    showModal(title, contentHTML, saveButton);
};

/** 儲存小朋友資料 */
window.saveKid = async (kidId = null) => {
    const nickname = document.getElementById('kidNickname').value.trim();
    const age = document.getElementById('kidAge').value.trim();
    const gender = document.getElementById('kidGender').value;

    if (!nickname) return showToast("暱稱是必填項目！", 'danger');

    const data = { nickname, age: age ? parseInt(age) : null, gender };

    try {
        if (kidId) {
            await updateDoc(doc(getKidCollectionRef(), kidId), data);
            showToast('小朋友資料更新成功！');
        } else {
            await addDoc(getKidCollectionRef(), data);
            showToast('小朋友資料新增成功！');
        }
        closeModal();
    } catch (error) {
        console.error("Error saving kid:", error);
        showToast(`儲存失敗: ${error.message}`, 'danger');
    }
};

/** 刪除小朋友資料 */
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
            render();
        } catch (error) {
            console.error("Error deleting kid:", error);
            showToast(`刪除失敗: ${error.message}`, 'danger');
        }
    }
};

/** 顯示編輯任務 Modal */
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

    const saveButton = `
        <button onclick="saveTaskForm('${taskId}')" class="px-4 py-2 bg-accent text-white rounded-lg font-bold hover:bg-teal-500">儲存</button>
    `;
    showModal(title, contentHTML, saveButton);
};

/** 儲存任務表單 */
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

/** 顯示編輯獎勵 Modal */
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

    const saveButton = `
        <button onclick="saveRewardForm('${rewardId}')" class="px-4 py-2 bg-accent text-white rounded-lg font-bold hover:bg-teal-500">儲存</button>
    `;
    showModal(title, contentHTML, saveButton);
};

/** 儲存獎勵表單 */
window.saveRewardForm = (rewardId) => {
    const data = {
        name: document.getElementById('rewardName').value.trim(),
        description: document.getElementById('rewardDescription').value.trim(),
        cost: document.getElementById('rewardCost').value.trim(),
    };
    if (!data.name || !data.cost) return showToast("商品名稱和點數是必填項！", 'danger');
    window.saveItem('reward', data, rewardId);
};


// --- INITIALIZATION AND LISTENERS ---

async function getKidState(kidId) {
    const kidDoc = await getDoc(getKidDocRef(kidId));
    if (kidDoc.exists()) {
        return kidDoc.data();
    } else {
        const initialData = {
            points: 0,
            spirits: [],
            lastTaskCompletion: {} 
        };
        await setDoc(getKidDocRef(kidId), initialData);
        return initialData;
    }
}

async function preloadInitialData() {
    if (!db) return;

    const taskQuery = await getDocs(getTaskCollectionRef());
    const rewardQuery = await getDocs(getRewardCollectionRef());
    const batch = writeBatch(db);
    let hasNewData = false;

    if (taskQuery.empty) {
        initialTasks.forEach(task => {
            batch.set(doc(getTaskCollectionRef()), task);
        });
        hasNewData = true;
    }

    if (rewardQuery.empty) {
        initialRewards.forEach(reward => {
            batch.set(doc(getRewardCollectionRef()), reward);
        });
        hasNewData = true;
    }

    if (hasNewData) {
        await batch.commit();
        showToast("預設任務與獎勵已載入！", 'info');
    }
}

function setupListeners() {
    onSnapshot(getKidCollectionRef(), (snapshot) => {
        state.kids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (!state.currentKidId || !state.kids.some(k => k.id === state.currentKidId)) {
            const savedKidId = localStorage.getItem('currentKidId');
            if (savedKidId && state.kids.some(k => k.id === savedKidId)) {
                state.currentKidId = savedKidId;
            } else if (state.kids.length > 0) {
                state.currentKidId = state.kids[0].id;
                state.currentView = 'tasks'; 
            } else {
                state.currentKidId = null;
                state.currentView = 'settings'; 
            }
        }
        render();
    });

    onSnapshot(getTaskCollectionRef(), (snapshot) => {
        state.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        render();
    });

    onSnapshot(getRewardCollectionRef(), (snapshot) => {
        state.rewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        render();
    });

    onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/kid_state`), (snapshot) => {
        state.kidData = {};
        snapshot.docs.forEach(doc => {
            state.kidData[doc.id] = doc.data();
        });
        render();
    });
}


/** 渲染主 App 介面 (核心渲染函數) */
window.render = () => {
    try {
        if (!state.isAuthReady) {
            console.log("[Render] Auth not ready, skipping render.");
            return;
        }

        const content = document.getElementById('content');
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (content) content.classList.remove('hidden');

        renderHeader();
        renderNavBar();
        
        const viewContent = document.getElementById('view-content');
        viewContent.innerHTML = '';

        const isInitialSetup = state.kids.length === 0;

        if (isInitialSetup && state.currentView !== 'settings') {
            viewContent.innerHTML = `
                <div class="text-center p-10 bg-pink-light/50 rounded-3xl mt-8 shadow-inner border border-pink-light">
                    <p class="text-3xl font-bold text-danger mb-4">🚫 請先設定小朋友資料</p>
                    <p class="text-gray-700 font-medium">請點擊右下角的「設定 ⚙️」頁面新增小朋友，才能使用此功能喔！</p>
                </div>
            `;
            return;
        }

        switch (state.currentView) {
            case 'tasks':
                viewContent.appendChild(renderTasks());
                break;
            case 'shop':
                viewContent.appendChild(renderShop());
                break;
            case 'spirits':
                viewContent.appendChild(renderSpirits());
                break;
            case 'settings':
                viewContent.appendChild(renderSettings(isInitialSetup));
                break;
            default:
                console.warn(`Unknown view: ${state.currentView}, defaulting to settings.`);
                state.currentView = 'settings';
                viewContent.appendChild(renderSettings(isInitialSetup));
        }
    } catch (e) {
        console.error("Fatal Error during render cycle:", e);
        showToast("應用程式渲染失敗，請檢查 Console", 'danger');
    }
};


async function initApp() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        try {
            console.log("[Auth] Attempting anonymous sign-in...");
            await signInAnonymously(auth);
        } catch(authError) {
             console.error("Firebase Authentication Failed:", authError);
             throw new Error("Authentication failed. Check Firebase Anonymous Sign-in settings.");
        }


        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                state.isAuthReady = true;
                console.log(`[Auth] User logged in: ${userId}`);
                
                preloadInitialData();
                setupListeners();
            } else {
                state.isAuthReady = false;
                document.getElementById('loading-screen').innerHTML = `
                    <div class="text-center p-8">
                        <p class="text-xl font-bold text-danger">連線失敗：請檢查 Firebase 匿名登入。</p>
                        <p class="mt-4 text-sm text-gray-600">請確認您的 Firebase 專案已啟用 **匿名登入 (Anonymous)** 功能。</p>
                    </div>
                `;
            }
        });

    } catch (error) {
        console.error("App Initialization Fatal Error:", error);
        document.getElementById('loading-screen').innerHTML = `
            <div class="text-center p-8 bg-white rounded-xl shadow-lg">
                <p class="text-xl font-bold text-danger">應用程式初始化失敗 (App Error)</p>
                <p class="mt-2 text-sm text-gray-700">錯誤訊息: ${error.message}</p>
                <p class="mt-4 text-sm font-bold text-primary">除錯提示:</p>
                <ul class="list-disc list-inside text-left text-sm text-gray-600 mx-auto w-fit">
                    <li>請檢查 **style.css** 和 **script.js** 檔案是否已上傳到 GitHub。</li>
                    <li>請確認您的 **Firebase 配置** (apiKey, projectId) 正確。</li>
                </ul>
            </div>
        `;
    }
}

window.onload = initApp;