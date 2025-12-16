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
export const state = {
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
    return collection(db, 'artifacts', appId, 'users', userId, 'data');
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

// --- UI 輔助函式 (Toast & Modal) ---

/** 顯示 Toast 提示訊息 */
export function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toastId = `toast-${Date.now()}`;
    const bgColor = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : 'bg-secondary';
    
    const toast = document.createElement('div');
    toast.id = toastId;
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

/** 顯示 Modal */
export function showModal(title, bodyHtml, confirmText = '確定', onConfirm = () => {}) {
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

    // 顯示容器
    modalContainer.classList.remove('hidden');

    // 延遲執行進入動畫
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);

    // 綁定確認按鈕事件
    document.getElementById('modal-confirm-btn').onclick = () => {
        onConfirm();
        closeModal();
    };
}

/** 關閉 Modal */
window.closeModal = function() {
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    
    // 執行退出動畫
    modalContent.classList.add('scale-95', 'opacity-0');

    // 退出動畫完成後隱藏容器
    modalContent.addEventListener('transitionend', () => {
        modalContainer.classList.add('hidden');
    }, { once: true });
}

// --- 資料預載與渲染函式 ---

/** 預載初始數據 (例如從 localStorage 載入 currentKidId) */
async function preloadInitialData() {
    // 檢查是否有儲存的 currentKidId，如果沒有，將在後續檢查中被引導至設定頁面
    const storedKidId = localStorage.getItem('currentKidId');
    if (storedKidId) {
        state.currentKidId = storedKidId;
    }
}

/** 渲染 Header 和 NavBar */
function renderHeaderAndNavBar(currentView, kidNickname = '設定中...') {
    const currentKid = state.kids.find(k => k.id === state.currentKidId);
    const currentKidData = state.kidData[state.currentKidId] || { points: 0, spirits: [] };
    
    const header = document.getElementById('kid-info');
    if (header) {
        header.innerHTML = `
            <div class="flex items-center space-x-3">
                <img src="images/kid-avatar.png" alt="Kid Avatar" class="w-12 h-12 rounded-full border-2 border-pink-light/80 shadow-md">
                <span class="text-xl font-bold text-primary">${currentKid ? currentKid.nickname : kidNickname}</span>
            </div>
            <div class="flex items-center space-x-2 p-2 bg-secondary/20 rounded-full points-pulse">
                <img src="images/coin.png" alt="Points" class="w-6 h-6">
                <span class="text-2xl font-extrabold text-secondary">${currentKidData.points || 0}</span>
            </div>
        `;
    }

    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        const navItems = [
            { name: '任務牆', view: 'tasks', icon: '✅', link: 'tasks.html' },
            { name: '精靈', view: 'spirits', icon: '🥚', link: 'spirits.html' },
            { name: '商店', view: 'shop', icon: '🎁', link: 'shop.html' },
            { name: '設定', view: 'settings', icon: '⚙️', link: 'settings.html' },
        ];
        
        navBar.innerHTML = navItems.map(item => `
            <a href="${item.link}" class="flex flex-col items-center justify-center p-2 rounded-xl transition duration-150 
                ${currentView === item.view ? 'bg-primary text-white shadow-xl scale-105' : 'text-gray-500 hover:bg-gray-100'}">
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

    // 監聽 Kids 集合
    onSnapshot(getKidCollectionRef(), (snapshot) => {
        state.kids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 處理 currentKidId 的選擇邏輯
        if (state.kids.length > 0) {
            // 如果當前 Kid ID 不存在或不在 Kids 清單中，則選擇第一個小朋友
            if (!state.currentKidId || !state.kids.some(k => k.id === state.currentKidId)) {
                state.currentKidId = state.kids[0].id;
                localStorage.setItem('currentKidId', state.currentKidId);
            }
        } else {
            // 如果清單為空，清空 currentKidId
            state.currentKidId = null;
            localStorage.removeItem('currentKidId');
        }

        updateUI();
    });

    // 監聽 Tasks 集合
    onSnapshot(getTaskCollectionRef(), (snapshot) => {
        state.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
    
    // 監聽 Rewards 集合
    onSnapshot(getRewardCollectionRef(), (snapshot) => {
        state.rewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI();
    });
    
    // 監聽所有 Kid States
    const kidStatesRef = collection(getUserArtifactsRef(), 'kid_states');
    onSnapshot(kidStatesRef, (snapshot) => {
        snapshot.docs.forEach(doc => {
            state.kidData[doc.id] = { id: doc.id, ...doc.data() };
        });
        updateUI();
    });
}


// --- 核心初始化與狀態設定 (initPage) ---

/** 處理 Firebase 登入並初始化數據監聽 */
export async function initPage(pageRenderFunc, pageViewName) {
    renderCallback = pageRenderFunc; // 設置頁面專屬的渲染函式

    const loadingScreen = document.getElementById('loading-screen');
    const content = document.getElementById('content');

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        console.log("[Base] App initialized. Attempting anonymous sign-in...");
        // 立即嘗試匿名登入
        await signInAnonymously(auth);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                state.isAuthReady = true;
                console.log(`[Base] Auth Success. User ID: ${userId}`);

                await preloadInitialData();

                // 設置持續監聽器。這些監聽器會持續更新 state
                setupListeners(pageViewName);

                // ----------------------------------------------------
                // 🌟 關鍵修正：使用一次性監聽器 (onSnapshot) 確保首次數據同步完成
                // ----------------------------------------------------
                const unsubscribeCheck = onSnapshot(getKidCollectionRef(), (snapshot) => {
                    const hasKids = snapshot.size > 0; // 使用 snapshot.size 確保數據已同步

                    if (!hasKids && pageViewName !== 'settings') {
                        // 首次載入且沒有小朋友，強制跳轉到設定頁面
                        console.log("[Base] No kids found on first sync. Redirecting to settings.");
                        unsubscribeCheck(); // 停止這個一次性監聽器
                        window.location.replace('settings.html');
                        return;
                    }

                    // 數據已同步且通過檢查，隱藏載入畫面並顯示內容
                    if (loadingScreen) loadingScreen.classList.add('hidden');
                    if (content) content.classList.remove('hidden');
                    console.log(`[Base] Initial render complete for view: ${pageViewName}`);

                    unsubscribeCheck(); // 成功後，停止這個一次性監聽器

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
                // Auth Failed UI (如果匿名登入失敗，會觸發這裡)
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
}

// --- 供其他檔案使用的匯出函式 (Exports) ---

// 匯出常用的 Firestore 函式
export { getFirestore, getDoc, setDoc, writeBatch, arrayUnion, getDocs, doc, collection };
// 匯出狀態
export { state, showToast, showModal, getKidStateDocRef };