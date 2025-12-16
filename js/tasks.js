// js/tasks.js
import { getKidStateDocRef, state, showToast, initPage, showModal, closeModal, speakText, setDoc } from "./base.js";

function renderTasksContent() {
  const view = document.getElementById("view-content");
  if (!view) return;
  const kidId = state.currentKidId;
  const kidState = state.kidData[kidId] || { points: 0, lastTaskCompletion: {} };
  const today = new Date().toDateString();

  const taskHtml = state.tasks.filter(t => {
    if (t.cycle === "daily") {
      const last = kidState.lastTaskCompletion?.[t.id];
      return last ? new Date(last).toDateString() !== today : true;
    }
    return true;
  }).map(t => `
    <div class="flex items-center justify-between bg-white p-4 rounded-2xl shadow mb-4 border-b-4 border-accent">
      <div class="flex-1">
        <p class="font-black text-xl text-primary">${t.name}</p>
        <p class="text-sm text-gray-500">${t.description || ""}</p>
      </div>
      <div class="flex items-center space-x-3">
        <span class="text-secondary font-black text-2xl">+${t.points}</span>
        <button onclick="window.completeTask('${t.id}', ${t.points})" class="w-12 h-12 bg-success text-white rounded-full text-2xl shadow-lg active:scale-95 transition">🎉</button>
      </div>
    </div>`).join("");

  view.innerHTML = `
    <h2 class="text-2xl font-black text-gray-800 mb-4">🌟 今日待辦任務</h2>
    ${taskHtml || '<div class="text-center p-8 bg-accent/10 rounded-2xl font-bold">任務都完成了，去精靈屋看看吧！</div>'}`;
  
  if (!localStorage.getItem('intro_seen')) showIntro();
}

function showIntro() {
  const story = "很久以前，精靈們被封印在蛋裡。需要小朋友的「主動能量」才能喚醒他們。完成任務，累積點數，拯救精靈吧！";
  showModal("🌲 森林的求救訊號", `<p class='leading-relaxed'>${story}</p>`, "開始冒險", () => {
    closeModal(); localStorage.setItem('intro_seen', '1');
  });
}

window.completeTask = async (taskId, pts) => {
  const kidId = state.currentKidId;
  if (!kidId) return showToast("請先選擇小朋友", "danger");
  const kidState = state.kidData[kidId] || { points: 0, lastTaskCompletion: {} };
  const newPoints = (kidState.points || 0) + pts;
  try {
    await setDoc(getKidStateDocRef(kidId), {
      points: newPoints,
      lastTaskCompletion: { ...kidState.lastTaskCompletion, [taskId]: Date.now() }
    });
    showToast(`完成任務！獲得 ${pts} 點`, "success");
    if (Math.floor(newPoints / 50) > Math.floor(kidState.points / 50)) showToast("獲得孵化機會！🥚", "success");
  } catch (e) { showToast("儲存失敗", "danger"); }
};

initPage(renderTasksContent, "tasks");