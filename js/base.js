// js/base.js
// ... (所有全域常數、Firebase Config、State, Firestore Paths, showToast/Modal 函式)

// --- 核心初始化與狀態設定 ---
let currentKidId = localStorage.getItem('currentKidId');

function setupKidStateListeners() {
    // 這裡只監聽 kids, tasks, rewards, kid_state
    // 當數據變化時，只需要更新 state，並通知當前頁面進行局部更新
    
    // ... onSnapshot(getKidCollectionRef(), ...)
    // ... onSnapshot(getTaskCollectionRef(), ...)
    // ... onSnapshot(getRewardCollectionRef(), ...)
    // ... onSnapshot(collection(db, ...), ...)
}

function renderHeader(currentKid) {
    // ... (保持不變)
}

function renderNavBar(currentView) {
    // 導航列需使用 a 標籤導向不同的 HTML 頁面
    // 並根據當前頁面 (currentView) 設置 active 樣式
    // ...
    // 導覽列項目 now 應使用 a 標籤
    // <a href="tasks.html" class="nav-item ${currentView === 'tasks' ? 'active' : ''}">...</a>
}

// 供外部頁面呼叫的初始化函式
window.initPage = async (pageRenderCallback, pageViewName) => {
    // 1. 初始化 Firebase
    // 2. 匿名登入 (若成功)
    // 3. 設置監聽器 (setupListeners)
    // 4. 執行 pageRenderCallback 渲染特定頁面內容
    // 5. 渲染 Header 和 NavBar (使用 pageViewName 標示當前頁面)
    // 6. 處理小朋友初始設定檢查

    // ... (initApp 邏輯) ...

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // ...
            
            // 處理 currentKidId, 檢查是否需要跳轉到 settings
            const isInitialSetup = state.kids.length === 0;
            if (isInitialSetup && pageViewName !== 'settings') {
                 // 頁面跳轉
                 window.location.href = 'settings.html';
                 return;
            }
            
            // 渲染共用 UI
            renderHeader(state.kids.find(k => k.id === state.currentKidId));
            renderNavBar(pageViewName);

            // 渲染頁面內容
            if (pageRenderCallback) {
                pageRenderCallback();
            }
        }
        // ... (連線失敗處理)
    });
};