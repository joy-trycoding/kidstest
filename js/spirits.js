// js/spirits.js (final)
import { state, initPage, showToast, getKidStateDocRef, setDoc, showModal, closeModal, speakText, stopSpeaking } from "./base.js";

const SFX_CRACK = "assets/sfx/egg_crack.mp3";
const SFX_HATCH = "assets/sfx/egg_hatch.mp3";

function playSfx(src) {
  try {
    const a = new Audio(src);
    a.volume = 0.85;
    a.play().catch(() => {});
  } catch {}
}

const SPIRITS = [
  { id: "aki", name: "小緋櫻花精靈", img: "assets/spirits/aki.png", desc: "小緋是從春天第一朵櫻花裡「咚」一聲跳出來的！當你覺得害怕、想放棄時，她會給你勇氣粉紅光。每完成一個任務，她就會幫你開出一朵新的漂亮花花。" },
  { id: "flower", name: "萌花草精靈", img: "assets/spirits/flower.png", desc: "萌花最喜歡躲在軟綿綿的草地裡，幫你把小小的努力變成大大的成就！她的花環會記住你的好習慣，只要你再試一次，萌花就會揮揮魔法棒，讓心情變亮晶晶！" },
  { id: "moon", name: "銀月精靈", img: "assets/spirits/moon.png", desc: "銀月是黑夜的守護小超人，會把吵鬧聲都變安靜。當你要專心收玩具時，他會撒下銀色月光，讓分心的小泡泡飛走。睡前完成任務，他會把你的夢整理得像棉花糖一樣甜喔！" },
  { id: "fire", name: "烈焰精靈", img: "assets/spirits/fire.png", desc: "烈焰像個紅通通的小火炬，最喜歡看你動起來！遇到不會的小難題，烈焰會陪你大喊：『一、二、三，出發！』第一步踏出去，火熱的信心就回來了！" },
  { id: "leaf", name: "風葉精靈", img: "assets/spirits/leaf.png", desc: "風葉精靈住在樹梢上，他會吹出涼涼的風，把著急通通吹跑。每當你收好玩具，風葉就會送你一片亮綠色的勳章，誇獎你是一個自律的小達人！" },
  { id: "silver", name: "閃銀精靈", img: "assets/spirits/silver.png", desc: "閃銀的眼睛像小星星一樣閃閃發光。當你完成任務，他會在空中畫出一條銀色閃電跑道，讓你像賽車手一樣衝向勝利！他會誇獎你：『你看，你真的做得超棒！』" },
  { id: "unicorn", name: "獨角獸精靈", img: "assets/spirits/unicorn.png", desc: "獨角獸精靈有神奇的角，能把難過變彩色泡泡。每次你很有禮貌地說話，或願意道歉，她就會送你一束七彩虹光，讓你的心變得軟綿綿的。" },
  { id: "star", name: "星宿精靈", img: "assets/spirits/star.png", desc: "星宿精靈是天空的畫家，他把你做的每一件好事都變成一顆小星星。只要你繼續加油，你的專屬星圖就會越來越亮，讓全世界都看到你的厲害。" },
  { id: "rose", name: "玫瑰精靈", img: "assets/spirits/rose.png", desc: "玫瑰精靈教你一個小秘密：『先做完該做的事，玩耍會變更好玩喔！』當你乖乖收拾東西，她的花瓣就會變更紅。她說：能把自己照顧好，才是最酷的小主角！" },
  { id: "wind", name: "風谷精靈", img: "assets/spirits/wind.png", desc: "風谷精靈在你覺得「好難喔」的時候出現。他會小聲說：『我們先做一件最簡單的就好！』完成後，他會在你耳邊吹出口哨聲，誇獎你：『做得好！下一個也難不倒你！』" },
  { id: "sound", name: "音符精靈", img: "assets/spirits/sound.png", desc: "音符精靈住在輕快的歌聲裡。當你刷牙、收書包時，他會敲出「叮叮咚咚」的節拍，讓你做起事來像跳舞一樣開心。完成時他還會為你演奏一首勝利主題曲喔！" },
  { id: "story", name: "故事精靈", img: "assets/spirits/story.png", desc: "故事精靈把你每天的任務都變成大冒險！每做完一件事，就翻開新的一頁。故事精靈相信，你就是書裡最勇敢的主角，只要動手去做，你的故事就會超級精彩！" },
  { id: "hope", name: "希望精靈", img: "assets/spirits/hope.png", desc: "希望精靈像一盞小燈籠，在你快放棄時發出暖暖的光。她會陪你把大困難切成小點心，一口一口吃掉。她說：不用急著一次做完，每天前進一點點就很棒了！" },
  { id: "sun", name: "太陽精靈", img: "assets/spirits/sun.png", desc: "太陽精靈最喜歡早起的小朋友了！如果你自己背起書包，他就會送你一圈金色護盾，讓你整天充滿電力。他說：守時的孩子，會有更多時間玩喜歡的玩具喔！" },
  { id: "color", name: "Lulu小精靈", img: "assets/spirits/color.png", desc: "露露是彩虹變出來的小仙女，翅膀一揮就會掉下亮晶晶的金粉。當你覺得任務難、心裡怕怕時，露露會變出彩虹小路引導你，讓害怕通通不見。" },
  { id: "water", name: "晨露小精靈", img: "assets/spirits/water.png", desc: "晨露就像涼涼的小水滴，能讓你熱熱的小腦袋冷靜下來。當你著急發脾氣時，她會請你先停下來、喝口水。冷靜做好事時，晨露就會亮起藍光誇獎你喔！" },
  { id: "shine", name: "耀星精靈", img: "assets/spirits/shine.png", desc: "閃閃是一個超級小飛俠，最喜歡跟時間賽跑！如果你做事很快不拖拉，他的尾巴就會發出閃電藍光，幫森林補滿電力。跟著閃閃，做任務會變得像賽車一樣刺激！" },
  { id: "wood", name: "月木精靈", img: "assets/spirits/wood.png", desc: "月葉是安靜的守護精靈。當你在看書寫字時，他會搖動樹葉讓時間變溫柔。他會送你發光的葉子禮物，告訴你：『專心是一種超能力，你正在變得很強大喔！』" },
  { id: "time", name: "時間精靈", img: "assets/spirits/time.png", desc: "時間精靈有神祕小沙漏，會把「拖延小怪獸」收走。只要你願意先試試看做五分鐘，時間精靈就會施魔法，讓任務變得超簡單、超快就能完成喔！" },
  { id: "light", name: "熱情精靈", img: "assets/spirits/light.png", desc: "閃耀是光的小隊長，最喜歡在你完成任務時大聲歡呼！他會變出小獎盃浮在空中。閃耀說：『你的心裡有一顆小太陽，只要你開心做事，就能照亮所有的人喔！』" }
];

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getEggSlots(kidState) {
  const slots = Array.isArray(kidState.eggSlots) ? kidState.eggSlots : null;
  if (slots && slots.length === 20) return slots;
  return Array.from({ length: 20 }, () => ({ status: "unhatched" }));
}

function renderSpiritsContent() {
  const view = document.getElementById("view-content");
  if (!view) return;

  const kidId = state.currentKidId;
  if (!kidId) {
    view.innerHTML = `<div class="p-6 bg-white rounded-3xl shadow-md">請先到「設定」新增小朋友。</div>`;
    return;
  }

  const kidState = state.kidData[kidId] || { points: 0 };
  const slots = getEggSlots(kidState);

  const hatchedCount = slots.filter((s) => s.status === "hatched").length;
  const available = Math.max(0, Math.floor(Number(kidState.points || 0) / 50) - hatchedCount);

  view.innerHTML = `
    <div class="bg-white p-5 rounded-3xl mb-6 shadow-xl border-4 border-primary/10">
      <h2 class="text-2xl font-black text-primary">🥚 精靈孵化屋</h2>
      <p class="mt-2 text-gray-600">每累積 50 點，就能孵化一顆蛋（不扣點數喔！）</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <span class="bg-secondary/10 text-secondary px-3 py-1 rounded-full font-bold">目前點數：${Number(kidState.points || 0)}</span>
        <span class="bg-accent/15 text-accent px-3 py-1 rounded-full font-bold">可孵化：${available}</span>
        <span class="bg-success/15 text-success px-3 py-1 rounded-full font-bold">已孵化：${hatchedCount}</span>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-24">
      ${slots.map((s, i) => {
        const canClick = available > 0 && s.status !== "hatched";
        const border = s.status === "hatched" ? "border-success" : canClick ? "border-accent" : "border-gray-200";
        const bg = s.status === "hatched" ? "bg-green-50" : "bg-white";
        const label = s.status === "hatched" ? escapeHtml(s.spirit?.name || "已孵化") : "神秘蛋";
        const img = s.status === "hatched"
          ? `<img src="${escapeHtml(s.spirit?.img || "assets/egg_shell.png")}" class="w-16 h-16 mx-auto mb-2 object-contain" />`
          : `<img src="assets/egg.png" class="w-16 h-16 mx-auto mb-2 object-contain ${canClick ? "" : "opacity-60 grayscale"}" />`;
        return `
          <button type="button"
            onclick="window.hatchEgg(${i})"
            class="${bg} p-4 rounded-3xl shadow text-center border-2 ${border} ${canClick ? "hover:scale-105 active:scale-95 transition" : "cursor-not-allowed"}"
            ${canClick ? "" : "disabled"}>
            ${img}
            <p class="font-black mt-1 text-sm truncate">${label}</p>
            <p class="text-xs text-gray-500 mt-1">${s.status === "hatched" ? "已孵化" : canClick ? "點我孵化" : "點數不足"}</p>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

window.hatchEgg = async (idx) => {
  const kidId = state.currentKidId;
  const kidState = state.kidData[kidId] || { points: 0 };
  const slots = getEggSlots(kidState);

  const hatched = slots.filter((s) => s.status === "hatched").length;
  const available = Math.max(0, Math.floor(Number(kidState.points || 0) / 50) - hatched);

  if (available <= 0) return showToast("再去多完成任務吧！", "info");
  if (slots[idx]?.status === "hatched") return;

  const used = new Set(slots.filter(s => s.status==="hatched" && s.spirit?.id).map(s => s.spirit.id));
  const pool = SPIRITS.filter(s => !used.has(s.id));
  const spirit = (pool.length ? pool : SPIRITS)[Math.floor(Math.random() * (pool.length ? pool.length : SPIRITS.length))];

  stopSpeaking();
  showModal(
    "🥚 孵化中...",
    `<div class="text-center">
        <img id="egg-stage-img" src="assets/egg.png" class="w-40 h-40 mx-auto object-contain" />
        <p class="mt-3 text-sm text-gray-500">準備裂殼…</p>
     </div>`,
    "開始",
    () => startHatchFlow(kidId, idx, spirit)
  );
};

async function startHatchFlow(kidId, idx, spirit) {
  const img = document.getElementById("egg-stage-img");
  if (!img) return;

  img.src = "assets/egg_crack.png";
  playSfx(SFX_CRACK);

  setTimeout(async () => {
    img.src = "assets/egg_shell.png";
    playSfx(SFX_HATCH);

    const kidState = state.kidData[kidId] || {};
    const slots = getEggSlots(kidState);
    const nextSlots = slots.map((s, i) => (i === idx ? { status: "hatched", spirit } : s));

    await setDoc(getKidStateDocRef(kidId), { eggSlots: nextSlots }, { merge: true });

    setTimeout(() => {
      showModal(
        "🎉 孵化成功！",
        `<div class="text-center">
            <img src="${escapeHtml(spirit.img)}" class="w-44 h-44 mx-auto object-contain mb-3" />
            <p class="text-2xl font-black text-primary">${escapeHtml(spirit.name)}</p>
            <p class="mt-3 text-left text-gray-700 leading-relaxed">${escapeHtml(spirit.desc)}</p>
            <div class="mt-4 flex justify-center gap-2">
              <button id="spirit-speak" class="px-4 py-2 bg-secondary text-white rounded-xl font-bold">🔊 聽故事</button>
            </div>
         </div>`,
        "完成",
        () => closeModal()
      );
      const btn = document.getElementById("spirit-speak");
      if (btn) btn.onclick = () => speakText(spirit.desc);
      speakText(spirit.desc);
    }, 450);
  }, 900);
}

initPage(renderSpiritsContent, "spirits");
  