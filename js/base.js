// js/base.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDoc, getDocs, writeBatch, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 設定 Firebase Debug Log
setLogLevel('Debug');

// --- Global Constants and Configuration ---
const appId = 'autonomy-helper-mock-id'; // 應用程式識別符
let app, db, auth, userId;
let renderCallback = () => {}; // 當前頁面渲染函式的回呼

// 模擬的 Firebase 配置 (請替換為您自己的配置)
const firebaseConfig = {
    apiKey: "AIzaSyDZ6A9haTwY6dCa93Tsa1X63ehzx-xe_FE", 
    authDomain: "kidstest-99c7f.firebaseapp.com",
    projectId: "kidstest-99c7f", 
    storageBucket: "kidstest-99c7f.firebasestorage.app", 
    messagingSenderId: "4719977826", 
    appId: "1:4719977826:web:e002e7b9b2036d3b39339e" 
};

// --- 全域狀態 (State) ---
const state = { // 🚨 移除 export 關鍵字
    isAuthReady: false,
    kids: [], // 小朋友清單
    currentKidId: localStorage.getItem('currentKidId') || null, // 當前選定的小朋友 ID
    tasks: [], // 任務清單
    rewards: [], // 獎勵清單
    kidData: {} // 存放每個小朋友的點數、精靈等狀態 { kidId: { points: 100, spirits: [...] } }
};


// --- Firestore 集合參考 (Collection References) ---

/** 取得使用者資料庫路徑 */
function getUserArtifactsRef() {
    if (!userId) throw new Error("User not authenticated.");
    return doc(db, 'artifacts', appId, 'users', userId);
}

/** 取得 Kids 集合參考 */
function getKidCollectionRef() { 
    return collection(getUserArtifactsRef(), 'kids');
}

/** 取得 Tasks 集合參考 */
function getTaskCollectionRef() { 
    return collection(getUserArtifactsRef(), 'tasks');
}

/** 取得 Rewards 集合參考 */
function getRewardCollectionRef() { 
    return collection(getUserArtifactsRef(), 'rewards');
}

/** 取得特定小朋友的狀態文件參考 */
function getKidStateDocRef(kidId) { 
    return doc(getUserArtifactsRef(), 'kid_states', kidId);
}

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

// --- UI 輔助函式 (Toast & Modal) ---

/** 顯示 Toast 提示訊息 */
function showToast(message, type = 'success') { // 🚨 移除 export
    const toastContainer = document.getElementById('toast-container');
    const bgColor = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : 'bg-secondary';
    
    const toast = document.createElement('div');
    toast.className = `p-4 rounded-xl shadow-lg text-white font-semibold transition-all duration-300 transform translate-x-full ${bgColor}`;
    toast.innerHTML = message;

    toastContainer.appendChild(toast);

    // 進入動畫
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 10);

    // 停留 3 秒後消失
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

/** 關閉 Modal (必須是全域函數供 HTML 按鈕調用) */
function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    
    modalContent.classList.add('scale-95', 'opacity-0');

    modalContent.addEventListener('transitionend', () => {
        modalContainer.classList.add('hidden');
    }, { once: true });
}
window.closeModal = closeModal; // 確保 HTML onclick="closeModal()" 可用

/** 顯示 Modal */
function showModal(title, bodyHtml, confirmText = '確定', onConfirm = () => {}) { // 🚨 移除 export
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    
    modalContent.innerHTML = `
        <h3 class="text-2xl font-bold text-primary mb-4 border-b pb-2">${title}</h3>
        <div class="modal-body mb-6 text-gray-700">${bodyHtml}</div>
        <div class="flex justify-end space-x-3">
            <button onclick="window.closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition duration-150">取消</button>
            <button id="modal-confirm-btn" class="px-4 py-2 ${confirmText === '刪除' ? 'bg-danger' : 'bg-primary'} text-white font-semibold rounded-xl hover:opacity-80 transition duration-150">${confirmText}</button>
        </div>
    `;

    modalContainer.classList.remove('hidden');

    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);

    document.getElementById('modal-confirm-btn').onclick = () => {
        onConfirm();
        window.closeModal();
    };
}

// --- Kid Switch Functions ---

/** 切換當前小朋友 (導出) */
const switchKid = (kidId) => { // 🚨 移除 export
    state.currentKidId = kidId;
    localStorage.setItem('currentKidId', kidId);
    showToast(`已切換至 ${state.kids.find(k => k.id === kidId)?.nickname || '新小朋友'}`, 'info');
    // 監聽器會自動觸發更新
};
window.switchKid = switchKid; // 確保 HTML 中 onclick 仍可呼叫

// --- 資料預載與渲染函式 ---

/** 預載初始數據 (將預設任務和獎勵寫入 Firestore) */
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
        console.log("[Base] Default data initialized.");
    }
}

/** 渲染 Header 和 NavBar */
function renderHeaderAndNavBar(currentView, kidNickname = '設定中...') {
    const currentKid = state.kids.find(k => k.id === state.currentKidId);
    const currentKidData = state.kidData[state.currentKidId] || { points: 0 };
    
    const header = document.getElementById('kid-info');
    if (header) {
        header.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-xl font-bold text-primary">${currentKid ? currentKid.nickname : kidNickname}</span>
            </div>
            <div class="flex items-center space-x-2 p-2 bg-secondary/20 rounded-full points-pulse">
                <span class="text-2xl font-extrabold text-secondary">${currentKidData.points || 0}</span>
                <span class="text-sm text-gray-800">點</span>
            </div>
        `;
    }

    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        const navItems = [
            { name: '任務牆', view: 'tasks', icon: '📝', link: 'tasks.html' },
            { name: '精靈', view: 'spirits', icon: '🥚', link: 'spirits.html' },
            { name: '商店', view: 'shop', icon: '🎁', link: 'shop.html' },
            { name: '設定', view: 'settings', icon: '⚙️', link: 'settings.html' },
        ];
        
        navBar.innerHTML = navItems.map(item => `
            <a href="${item.link}" class="flex flex-col items-center justify-center p-2 flex-1 transition-colors 
                ${currentView === item.view ? 'text-primary font-bold bg-gray-100 rounded-lg' : 'text-gray-400 hover:text-gray-600'}">
                <span class="text-2xl">${item.icon}</span>
                <span class="text-xs font-medium mt-1">${item.name}</span>
            </a>
        `).join('');
    }
}


// --- 數據監聽與更新 (核心同步邏輯) ---

/** 設置所有 Firestore 數據監聽器 */
function setupListeners(pageViewName) {
    
    /** 更新 UI 的統一函式，每次數據變化時呼叫 */
    const updateUI = () => {
        const currentKid = state.kids.find(k => k.id === state.currentKidId);
        // 渲染 Header 和 NavBar (使用當前選定的小朋友暱稱或預設值)
        renderHeaderAndNavBar(pageViewName, currentKid?.nickname || '設定中...');
        
        // 呼叫當前頁面專屬的渲染函式
        renderCallback();
    };

    // 錯誤處理函式
    const handleError = (error, collectionName) => {
        console.error(`[Base] Firestore Listener Failed for ${collectionName}:`, error);
        showToast(`數據讀取失敗 (${collectionName})。請檢查網路或 Firestore 規則。`, 'danger');
    };

    // 監聽 Kids 集合
    onSnapshot(getKidCollectionRef(), (snapshot) => {
        state.kids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (state.kids.length > 0) {
            if (!state.currentKidId || !state.kids.some(k => k.id === state.currentKidId)) {
                state.currentKidId = state.kids[0].id;
                localStorage.setItem('currentKidId', state.currentKidId);
            }
        } else {
            state.currentKidId = null;
            localStorage.removeItem('currentKidId');
        }

        updateUI();
    }, (error) => handleError(error, 'Kids'));

    // 監聽 Tasks 集合
    onSnapshot(getTaskCollectionRef(), (snapshot) => {
        state.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    }, (error) => handleError(error, 'Tasks'));
    
    // 監聽 Rewards 集合
    onSnapshot(getRewardCollectionRef(), (snapshot) => {
        state.rewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    }, (error) => handleError(error, 'Rewards'));
    
    // 監聽所有 Kid States
    const kidStatesRef = collection(getUserArtifactsRef(), 'kid_states');
    onSnapshot(kidStatesRef, (snapshot) => {
        state.kidData = {};
        snapshot.docs.forEach(doc => {
            state.kidData[doc.id] = { id: doc.id, ...doc.data() };
        });
        updateUI();
    }, (error) => handleError(error, 'Kid States'));
}


// --- 核心初始化與狀態設定 (initPage) ---

/** 處理 Firebase 登入並初始化數據監聽 */
function initPage(pageRenderFunc, pageViewName) { // 🚨 移除 export, 讓它在底部統一匯出
    renderCallback = pageRenderFunc;

    const loadingScreen = document.getElementById('loading-screen');
    const content = document.getElementById('content');

    // 將所有非同步邏輯包裹在一個立即執行的 async 函式中
    (async () => {
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            await signInAnonymously(auth);

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    userId = user.uid;
                    state.isAuthReady = true;
                    console.log(`[Base] Auth Success. User ID: ${userId}`);

                    await preloadInitialData();

                    // 設置持續監聽器
                    setupListeners(pageViewName);

                    // 🌟 關鍵修正：使用一次性監聽器確保首次數據同步完成
                    const unsubscribeCheck = onSnapshot(getKidCollectionRef(), (snapshot) => {
                        const hasKids = snapshot.size > 0;

                        if (!hasKids && pageViewName !== 'settings') {
                            // 首次載入且沒有小朋友，強制跳轉到設定頁面
                            console.log("[Base] No kids found on first sync. Redirecting to settings.");
                            unsubscribeCheck();
                            window.location.replace('settings.html');
                            return;
                        }

                        // 數據已同步且通過檢查，隱藏載入畫面並顯示內容
                        if (loadingScreen) loadingScreen.classList.add('hidden');
                        if (content) content.classList.remove('hidden');
                        console.log(`[Base] Initial render complete for view: ${pageViewName}`);

                        unsubscribeCheck();

                    }, (error) => {
                        // 如果第一次同步就失敗 (例如，Firestore 規則錯誤)，則顯示錯誤
                        console.error("[Base] Initial Kids Sync Failed:", error);
                        unsubscribeCheck();
                        if (loadingScreen) loadingScreen.classList.add('hidden');
                        if (content) {
                            content.classList.remove('hidden');
                            content.innerHTML = `<p class="text-xl font-bold text-danger">數據同步失敗，請檢查 Firestore 規則。</p>`;
                        }
                    });

                } else {
                    // Auth Failed UI
                    console.error("[Base] Firebase Authentication Failed. User object is null.");

                    if (loadingScreen) {
                        loadingScreen.classList.add('hidden');
                        if (content) {
                            content.classList.remove('hidden');
                            content.innerHTML = `
                                <div class="text-center p-10 bg-danger/10 rounded-3xl mt-8 shadow-inner border border-danger">
                                    <p class="text-3xl font-bold text-danger mb-4">🚫 Firebase 連線失敗</p>
                                    <p class="text-gray-700 font-medium">請確認您的 Firebase 專案已啟用 **匿名登入 (Anonymous)** 功能。</p>
                                </div>
                            `;
                        }
                    }
                }
            });
        } catch (error) {
            // 發生在 Firebase 初始化或 await signInAnonymously 步驟的致命錯誤
            console.error("App Initialization Fatal Error:", error);
            if (loadingScreen) loadingScreen.classList.add('hidden');

            if (content) {
                content.classList.remove('hidden');
                content.innerHTML = `
                    <div class="text-center p-8 bg-danger/10 rounded-xl shadow-lg mt-8">
                        <p class="text-xl font-bold text-danger">應用程式初始化失敗 (Fatal Error)</p>
                        <p class="mt-2 text-sm text-gray-700">錯誤訊息: ${error.message}</p>
                    </div>
                `;
            }
        }
    })(); // 立即執行
}

// --- 供其他檔案使用的匯出函式 (Exports) ---

// 匯出常用的 Firestore 函式
export { getFirestore, getDoc, setDoc, writeBatch, arrayUnion, getDocs, doc, collection };

// 匯出功能函式和集合參考 (統一匯出，確保不重複)
export { 
    state, 
    showToast, 
    showModal, 
    switchKid, 
    getKidCollectionRef, 
    getTaskCollectionRef, 
    getRewardCollectionRef, 
    getKidStateDocRef, 
    initPage 
};

