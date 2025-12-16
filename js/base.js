// js/base.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDoc, getDocs, writeBatch, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 設定 Firebase Debug Log
setLogLevel('Debug');

// --- Global Constants and Configuration ---
const appId = 'autonomy-helper-mock-id';
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
export let db;
export let auth;
export let userId = null;

// --- App State (導出供其他頁面使用) ---
export const state = {
    isAuthReady: false,
    kids: [],
    currentKidId: localStorage.getItem('currentKidId') || null, 
    tasks: [],
    rewards: [],
    kidData: {}, 
    modalOpen: false,
};

// --- Firestore Paths ---
export const getKidCollectionRef = () => collection(db, `artifacts/${appId}/users/${userId}/kids`);
export const getTaskCollectionRef = () => collection(db, `artifacts/${appId}/users/${userId}/tasks`);
export const getRewardCollectionRef = () => collection(db, `artifacts/${appId}/users/${userId}/rewards`);
export const getKidDocRef = (kidId) => doc(db, `artifacts/${appId}/users/${userId}/kid_state/${kidId}`);

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

// --- Core Utility Functions (導出) ---

/** 顯示 Toast 訊息 */
export const showToast = (message, type = 'success') => {
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
export const showModal = (title, contentHTML, buttonsHTML = '') => {
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
window.showModal = showModal;

/** 關閉 Modal */
export const closeModal = () => {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    modalContent.addEventListener('transitionend', () => {
        document.getElementById('modal-container').classList.add('hidden');
        state.modalOpen = false;
    }, { once: true });
};
window.closeModal = closeModal;

// --- Kid Switch Functions ---

/** 切換當前小朋友 (導出) */
export const switchKid = (kidId) => {
    state.currentKidId = kidId;
    localStorage.setItem('currentKidId', kidId);
    showToast(`已切換至 ${state.kids.find(k => k.id === kidId)?.nickname || '新小朋友'}`, 'info');
    // 不需要手動觸發 renderCallback，因為 state.currentKidId 變更會觸發 onSnapshot 監聽器
};
window.switchKid = switchKid; // 確保 HTML 中 onclick 仍可呼叫

/** 顯示小朋友切換 Modal (導出) */
export const showKidSwitchModal = () => {
    const contentHTML = state.kids.map(kid => `
        <button onclick="switchKidAndCloseModal('${kid.id}')" class="w-full text-left p-4 rounded-xl border-2 transition-all ${kid.id === state.currentKidId ? 'bg-primary text-white border-primary shadow-lg' : 'bg-bg-light hover:bg-gray-100 border-gray-200'}">
            <span class="font-bold text-lg">${kid.nickname}</span> ${kid.id === state.currentKidId ? ' (當前 👑)' : ''}
        </button>
    `).join('');

    showModal('切換小朋友', contentHTML);
}
window.showKidSwitchModal = showKidSwitchModal;

/** 切換小朋友並關閉 Modal (導出) */
export const switchKidAndCloseModal = (kidId) => {
    switchKid(kidId);
    closeModal();
}
window.switchKidAndCloseModal = switchKidAndCloseModal; // 確保 Modal 內部可呼叫

// --- UI Rendering (Shared) ---

function renderHeaderAndNavBar(currentView, kidNickname) {
    const kidInfo = document.getElementById('kid-info');
    const navBar = document.getElementById('nav-bar');
    
    // Header 渲染
    if (kidInfo) {
        if (state.currentKidId) {
            kidInfo.innerHTML = `
                <span class="font-bold text-lg text-secondary">${kidNickname}</span>
                <button onclick="showKidSwitchModal()" class="flex items-center space-x-1 p-2 bg-indigo-600 rounded-full hover:bg-indigo-700">
                    <span class="text-sm">切換</span>
                    <span class="text-xl">🔄</span>
                </button>
            `;
        } else {
             kidInfo.innerHTML = `<span class="text-sm text-yellow-300">未選定小朋友</span>`;
        }
    }

    // Navigation Bar 渲染
    const navItems = [
        { view: 'tasks', label: '任務牆', icon: '📝', href: 'tasks.html' },
        { view: 'shop', label: '獎勵商城', icon: '🛍️', href: 'shop.html' },
        { view: 'spirits', label: '精靈蛋屋', icon: '🥚', href: 'spirits.html' },
        { view: 'settings', label: '設定', icon: '⚙️', href: 'settings.html' }
    ];

    if (navBar) {
        navBar.innerHTML = navItems.map(item => {
            const isActive = currentView === item.view;
            return `
                <a href="${item.href}" class="flex flex-col items-center justify-center p-2 flex-1 transition-colors ${isActive ? 'text-primary font-bold' : 'text-gray-400 hover:text-gray-600'}">
                    <span class="text-2xl">${item.icon}</span>
                    <span class="text-xs mt-1">${item.label}</span>
                </a>
            `;
        }).join('');
    }
}

// --- Data Listeners ---

let renderCallback = () => {}; // 由頁面 JS 設定的專屬渲染函式

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

function setupListeners(pageViewName) {
    const updateUI = () => {
        const currentKid = state.kids.find(k => k.id === state.currentKidId);
        renderHeaderAndNavBar(pageViewName, currentKid?.nickname || '小朋友');
        renderCallback();
    };

    onSnapshot(getKidCollectionRef(), (snapshot) => {
        state.kids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 確保 currentKidId 有效
        if (!state.kids.some(k => k.id === state.currentKidId)) {
            // 如果當前選定的小朋友被刪除，則切換到第一個或設為 null
            state.currentKidId = state.kids.length > 0 ? state.kids[0].id : null;
            localStorage.setItem('currentKidId', state.currentKidId);
        }
        
        // 🚨 注意：這裡不再進行強制跳轉，邏輯已移至 initPage
        updateUI();
    });

    onSnapshot(getTaskCollectionRef(), (snapshot) => {
        state.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });

    onSnapshot(getRewardCollectionRef(), (snapshot) => {
        state.rewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });

    onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/kid_state`), (snapshot) => {
        state.kidData = {};
        snapshot.docs.forEach(doc => {
            state.kidData[doc.id] = doc.data();
        });
        updateUI();
    });
}

// --- Initialization Entry Point (修正後的完整結構) ---

/** 處理 Firebase 登入並初始化數據監聽 */
export async function initPage(pageRenderFunc, pageViewName) {
    renderCallback = pageRenderFunc; // 設置頁面專屬的渲染函式

    const loadingScreen = document.getElementById('loading-screen');
    const content = document.getElementById('content');

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // 立即嘗試匿名登入
        await signInAnonymously(auth);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                state.isAuthReady = true;

                await preloadInitialData();
                
                // 必須在設置監聽器之前，確保 Kids 數據有機會被載入。
                // 這裡我們利用 onSnapshot 會立即觸發一次的特性。
                
                // 設置監聽器
                setupListeners(pageViewName); 

                // 🌟 單次檢查：確認是否需要強制跳轉到設定頁面
                // 由於 onSnapshot 會立即觸發並更新 state.kids，我們使用延遲來確保第一次數據同步。
                setTimeout(() => {
                    if (state.kids.length === 0 && pageViewName !== 'settings') {
                        // 首次載入且沒有小朋友，強制跳轉到設定頁面
                        window.location.replace('settings.html');
                        return; 
                    }
                    
                    // 初始頁面渲染
                    if (loadingScreen) loadingScreen.classList.add('hidden');
                    if (content) content.classList.remove('hidden');
                    // 首次載入時觸發頁面渲染 (由 setupListeners 內的 updateUI 處理)
                    // renderCallback(); // 這裡不需要手動呼叫，因為 setupListeners 會立即觸發 updateUI
                }, 200); // 給數據同步一個小的延遲時間
                
            } else {
                // Auth Failed UI
                if (loadingScreen) loadingScreen.innerHTML = `<p class="text-xl font-bold text-danger">連線失敗：請檢查 Firebase 匿名登入。</p>`;
            }
        });
    } catch (error) {
        console.error("App Initialization Fatal Error:", error);
        if (loadingScreen) loadingScreen.innerHTML = `
            <div class="text-center p-8 bg-white rounded-xl shadow-lg">
                <p class="text-xl font-bold text-danger">應用程式初始化失敗 (App Error)</p>
                <p class="mt-2 text-sm text-gray-700">錯誤訊息: ${error.message}</p>
            </div>
        `;
    }
}