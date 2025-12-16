// js/base.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, getDoc, getDocs, writeBatch, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Constants and Configuration (與原 script.js 相同) ---
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
let db;
let auth;
export let userId = null; // 導出 userId

// --- App State (導出供其他頁面使用) ---
export const state = {
    isAuthReady: false,
    kids: [],
    currentKidId: localStorage.getItem('currentKidId') || null, // 從 localStorage 載入
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

// --- 共用 UI 函式 (導出供其他頁面使用) ---

/** 顯示 Toast 訊息 */
export const showToast = (message, type = 'success') => {
    // ... (保持原 showToast 邏輯) ...
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
    // ... (保持原 showModal 邏輯) ...
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
export const closeModal = () => {
    // ... (保持原 closeModal 邏輯) ...
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    modalContent.addEventListener('transitionend', () => {
        document.getElementById('modal-container').classList.add('hidden');
        state.modalOpen = false;
    }, { once: true });
};


/** 渲染 Header 和 Nav Bar */
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

    // Navigation Bar 渲染 (使用 a 標籤導向不同 HTML 頁面)
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

/** 核心監聽器設置 */
let renderCallback = () => {}; // 預設為空函式，由頁面 JS 設定

function setupListeners() {
    // 監聽 Kids 列表
    onSnapshot(getKidCollectionRef(), (snapshot) => {
        state.kids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 處理 currentKidId 變動
        if (!state.kids.some(k => k.id === state.currentKidId)) {
            state.currentKidId = state.kids.length > 0 ? state.kids[0].id : null;
            localStorage.setItem('currentKidId', state.currentKidId);
        }
        // 重新渲染頁面內容
        renderCallback();
    });

    // 監聽 Tasks
    onSnapshot(getTaskCollectionRef(), (snapshot) => {
        state.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCallback();
    });

    // 監聽 Rewards
    onSnapshot(getRewardCollectionRef(), (snapshot) => {
        state.rewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCallback();
    });

    // 監聽 Kid State
    onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/kid_state`), (snapshot) => {
        state.kidData = {};
        snapshot.docs.forEach(doc => {
            state.kidData[doc.id] = doc.data();
        });
        renderCallback();
    });
}

// --- 導出函式，供每個頁面 JS 呼叫 ---

/** 切換當前小朋友 (導出) */
export const switchKid = (kidId) => {
    state.currentKidId = kidId;
    localStorage.setItem('currentKidId', kidId);
    showToast(`已切換至 ${state.kids.find(k => k.id === kidId)?.nickname || '新小朋友'}`, 'info');
    renderCallback(); // 觸發頁面渲染
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

/** 處理 Firebase 登入並初始化數據監聽 */
export async function initPage(pageRenderCallback, pageViewName) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    renderCallback = pageRenderCallback; // 設置頁面專屬的渲染函式

    const loadingScreen = document.getElementById('loading-screen');
    const content = document.getElementById('content');

    try {
        await signInAnonymously(auth);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                state.isAuthReady = true;

                // 預載入預設數據 (初次使用時)
                // await preloadInitialData(); 
                
                setupListeners(); // 設置數據監聽

                if (loadingScreen) loadingScreen.classList.add('hidden');
                if (content) content.classList.remove('hidden');

                // 初次渲染 (Header/NavBar 和頁面內容)
                const currentKid = state.kids.find(k => k.id === state.currentKidId);
                renderHeaderAndNavBar(pageViewName, currentKid?.nickname || '小朋友');

                // 檢查是否需要強制跳轉到設定頁面
                if (state.kids.length === 0 && pageViewName !== 'settings') {
                    window.location.replace('settings.html');
                } else if (state.kids.length > 0 && !state.currentKidId) {
                    // 如果有 Kid 但沒有 currentKidId，選擇第一個並重新渲染
                    state.currentKidId = state.kids[0].id;
                    localStorage.setItem('currentKidId', state.currentKidId);
                    renderHeaderAndNavBar(pageViewName, state.kids[0].nickname);
                }

                pageRenderCallback(); // 呼叫頁面專屬渲染
            } else {
                // ... (Auth Failed UI) ...
            }
        });
    } catch (error) {
        // ... (Initialization Fatal Error UI) ...
        console.error("App Initialization Fatal Error:", error);
    }
}