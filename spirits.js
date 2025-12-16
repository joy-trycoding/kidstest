// js/spirits.js (v3)
// Rule update:
// - Every 50 points unlocks 1 hatch chance.
// - Points are NOT deducted when hatching (points remain for shop).
// Features:
// - 20 egg slots grid (RWD)
// - Shows points, hatched/unhatched counts, and "available hatches".
// - Unhatched eggs show how many points to NEXT hatch unlock.
// - Hatch flow: crack SFX + animation -> success SFX + spirit reveal
// - Spirit story supports TTS (uses base.speakText)
// Assets you should add:
// /kidstest/assets/egg.png
// /kidstest/assets/egg_crack.png
// /kidstest/assets/egg_shell.png (optional)
// /kidstest/assets/sfx/egg_crack.mp3
// /kidstest/assets/sfx/hatch_success.mp3

import {
    state,
    initPage,
    showToast,
    getKidStateDocRef,
    setDoc,
    showModal,
    closeModal,
    speakText,
    stopSpeaking,
  } from "./base.js";
  
  const HATCH_STEP = 50;
  const TOTAL_EGGS = 20;
  
  const IMG_EGG = "assets/egg.png";
  const IMG_EGG_CRACK = "assets/egg_crack.png";
  const IMG_EGG_SHELL = "assets/egg_shell.png"; // optional (not required)
  
  const SFX_CRACK = "assets/sfx/egg_crack.mp3";
  const SFX_SUCCESS = "assets/sfx/hatch_success.mp3";
  
  // Replace with your full 20 spirits list if you want (paste here)
  const SPIRIT_POOL = [
            {
              id: "aki",
              name: "小緋櫻花精靈",
              img: "assets/spirits/aki.png",
              desc: "小緋是從春天第一朵櫻花裡「咚」一聲跳出來的！當你覺得害怕、想放棄時，她會在你肩上輕輕跳一下，給你勇氣粉紅光。她常說：『我們先做一小步就好喔！』每當你完成一個任務，小緋就會幫你開出一朵新的漂亮花花。"
            },
            {
              id: "flower",
              name: "萌花草精靈",
              img: "assets/spirits/flower.png",
              desc: "萌花最喜歡躲在軟綿綿的草地裡，幫你把小小的努力變成大大的成就！她的花環會記住你每天的好習慣，當你累的時候，她會送出香香的氣味幫你加油。只要你願意再試一次，萌花就會揮揮魔法棒，讓你的心情變得亮晶晶！"
            },
            {
              id: "moon",
              name: "銀月精靈",
              img: "assets/spirits/moon.png",
              desc: "銀月是黑夜的守護小超人，會把吵鬧聲都變安靜。當你要專心寫字、收玩具時，他會撒下銀色月光，讓分心的小泡泡通通飛走。如果你睡覺前把任務都做完了，他會把你的夢整理得像棉花糖一樣甜、一樣溫柔喔！"
            },
            {
              id: "fire",
              name: "烈焰精靈",
              img: "assets/spirits/fire.png",
              desc: "烈焰像個紅通通的小火炬，最喜歡看你動起來！當你開始做事，他的尾巴會發出橘色光，讓你手腳變快、充滿力氣。遇到不會的小難題，烈焰會陪你一起大喊：『一、二、三，出發！』第一步踏出去，火熱的信心就回來了！"
            },
            {
              id: "leaf",
              name: "風葉精靈",
              img: "assets/spirits/leaf.png",
              desc: "風葉精靈住在樹梢上，他會吹出涼涼的風，把你的著急通通吹跑。當東西亂七八糟時，他會提醒你：『先理理桌面，再理理心。』每當你收好玩具或幫忙家事，風葉就會送你一片亮綠色的勳章，誇獎你是一個自律的小達人！"
            },
            {
              id: "silver",
              name: "閃銀精靈",
              img: "assets/spirits/silver.png",
              desc: "閃銀的眼睛像小星星一樣閃閃發光，他最喜歡把規矩變成好玩的遊戲。當你認真完成任務，他會在空中畫出一條銀色的閃電跑道，讓你像賽車手一樣衝向勝利！閃銀會抱抱你說：『你看，只要努力，你真的可以做得超棒！』"
            },
            {
              id: "unicorn",
              name: "獨角獸精靈",
              img: "assets/spirits/unicorn.png",
              desc: "獨角獸精靈有神奇的角，能把難過的事情變成彩色泡泡。當你想哭哭或生氣時，她會輕輕碰碰你的頭，陪你一起深呼吸。每次你很有禮貌地說話，或是願意分享、道歉，她就會送你一束七彩的虹光，讓你的心變得軟綿綿的。"
            },
            {
              id: "star",
              name: "星宿精靈",
              img: "assets/spirits/star.png",
              desc: "星宿精靈是天空的畫家，他把你做的每一件好事都變成一顆小星星。當你覺得自己做得不夠好，他會指著天空說：『看！那顆亮亮的星就是你剛剛的努力喔！』只要你繼續加油，你的專屬星圖就會越來越亮，讓全世界都看到你的厲害。"
            },
            {
              id: "rose",
              name: "玫瑰精靈",
              img: "assets/spirits/rose.png",
              desc: "玫瑰精靈漂亮又勇敢，她會教你一個小秘密：『先做完該做的事，玩耍會變得更好玩！』當你乖乖收拾好東西，她的花瓣就會變得更紅、更亮。她會牽著你的手說：『能把自己照顧好的孩子，才是最酷的小公主和小王子！』"
            },
            {
              id: "wind",
              name: "風谷精靈",
              img: "assets/spirits/wind.png",
              desc: "風谷精靈會在你覺得事情「好難喔」的時候出現，他會吹一陣風，把困難的事情吹散開來。他會小聲說：『我們先做一件最簡單的就好！』當你完成後，他會在你耳邊吹出好聽的口哨聲，像是在說：『做得好！下一個也難不倒你！』"
            },
            {
              id: "sound",
              name: "音符精靈",
              img: "assets/spirits/sound.png",
              desc: "音符精靈住在輕快的歌聲裡，最喜歡幫你的努力配音樂。當你刷牙、收書包時，他會敲出「叮叮咚咚」的節拍，讓你做起事來像跳舞一樣開心。如果你不小心分心了，他會彈出一個特別的音符提醒你，完成任務時還會為你演奏一首勝利主題曲喔！"
            },
            {
              id: "story",
              name: "故事精靈",
              img: "assets/spirits/story.png",
              desc: "故事精靈把你每天的小任務都變成大冒險！每做完一件事，就像翻開新的一頁。當你覺得無聊，他會變出一個驚喜小彩蛋，讓挑戰變得像玩遊戲。故事精靈相信，你就是這本書裡最勇敢的主角，只要動手去做，你的故事就會超級精彩！"
            },
            {
              id: "hope",
              name: "希望精靈",
              img: "assets/spirits/hope.png",
              desc: "希望精靈像一盞小燈籠，在你快要放棄時發出暖暖的光。她會陪著你把大大的困難切成一塊一塊的小點心，讓你一口一口吃掉。她常溫柔地說：『不用急著一次做完，我們每天前進一點點，就會離目標越來越近喔！』"
            },
            {
              id: "sun",
              name: "太陽精靈",
              img: "assets/spirits/sun.png",
              desc: "太陽精靈最喜歡早起的小朋友了！如果你準時起床、自己背起書包，他就會送你一圈金色的太陽護盾，讓你整天都充滿電力。太陽精靈說：『乖乖遵守時間，你就會發現多出了好多時間，可以拿來玩你最喜歡的玩具喔！』"
            },
            {
              id: "color",
              name: "Lulu小精靈",
              img: "assets/spirits/color.png",
              desc: "露露是雨後彩虹變出來的小仙女，翅膀一揮就會掉下亮晶晶的金色粉末。當你覺得任務好難、心裡怕怕的時候，露露會變出一條彩虹小路引導你，讓害怕通通不見。她是森林裡的醫護兵，最喜歡用溫柔的光抱抱每一個努力的小朋友。"
            },
            {
              id: "water",
              name: "晨露小精靈",
              img: "assets/spirits/water.png",
              desc: "晨露就像涼涼的小水滴，能讓你熱熱的小腦袋冷靜下來。當你太著急、想發脾氣時，她會請你先停下來、喝口水、深呼吸。每當你冷靜地把事情做好，晨露就會在你身邊亮起透明的藍光，誇獎你是一個最沉穩的小聰明！"
            },
            {
              id: "shine",
              name: "耀星精靈",
              img: "assets/spirits/shine.png",
              desc: "閃閃是一個超級小飛俠，最喜歡跟時間賽跑！如果你做事很快、不拖拉，他的尾巴就會發出閃電藍光，幫整座森林補充滿滿的電力。雖然他有點愛搗蛋，但最喜歡看到小朋友把亂七八糟的東西排整齊。跟著閃閃，做任務也會變得像賽車一樣刺激！"
            },
            {
              id: "wood",
              name: "月木精靈",
              img: "assets/spirits/wood.png",
              desc: "月葉是安靜的守護精靈，最喜歡看你專心做事的樣子。當你在看書或寫字時，他會輕輕搖動樹葉，讓時間變得很慢很舒服。每當你專心完成一件事，他會送你一片發光的葉子禮物，告訴你：『專心是一種超能力，你正在變得很強大喔！』"
            },
            {
              id: "time",
              name: "時間精靈",
              img: "assets/spirits/time.png",
              desc: "時間精靈有一個神祕的小沙漏，會幫你把愛東張西望的「拖延小怪獸」收走。當你專心時，他會讓時間變得很好用；當你分心時，他會拍拍你的小手提醒你。只要你願意先試試看做五分鐘，時間精靈就會施法，讓任務變得超簡單、超快完成！"
            },
            {
              id: "light",
              name: "熱情精靈",
              img: "assets/spirits/light.png",
              desc: "閃耀是光的小隊長，最喜歡在你完成任務時大聲歡呼！他會變出一個亮晶晶的小獎盃浮在空中。當你需要勇氣，他會把周圍照得亮閃閃的。閃耀說：『你的心裡有一顆小太陽，只要你開心做事，這道光就能照亮所有的人喔！』"
            }
          ];
  
  function playSfx(path) {
    try {
      const a = new Audio(path);
      a.volume = 0.65;
      a.play().catch(() => {});
    } catch {}
  }
  
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  
  function pickRandomSpirit() {
    return SPIRIT_POOL[Math.floor(Math.random() * SPIRIT_POOL.length)];
  }
  
  function getKidState() {
    const kidId = state.currentKidId;
    const kidState = (kidId && state.kidData && state.kidData[kidId]) ? state.kidData[kidId] : null;
    return { kidId, kidState: kidState || { points: 0, eggSlots: [] } };
  }
  
  function ensureEggSlots(kidId, kidState) {
    const slots = Array.isArray(kidState.eggSlots) ? kidState.eggSlots : null;
    if (slots && slots.length === TOTAL_EGGS) return;
  
    const eggSlots = Array.from({ length: TOTAL_EGGS }, () => ({ status: "unhatched" }));
    setDoc(getKidStateDocRef(kidId), { eggSlots }, { merge: true }).catch(() => {});
    state.kidData[kidId] = { ...(kidState || {}), eggSlots };
  }
  
  function calcHatchedCount(eggSlots) {
    return (eggSlots || []).filter((s) => s && s.status === "hatched").length;
  }
  
  function calcAvailableHatches(points, hatchedCount) {
    const unlocked = Math.floor((Number(points) || 0) / HATCH_STEP);
    return Math.max(0, unlocked - (Number(hatchedCount) || 0));
  }
  
  function pointsToNextUnlock(points) {
    const p = Number(points) || 0;
    const mod = p % HATCH_STEP;
    return mod === 0 ? 0 : (HATCH_STEP - mod);
  }
  
  let isHatching = false;
  
  function renderSpiritsContent() {
    const viewContent = document.getElementById("view-content");
    if (!viewContent) return;
  
    const { kidId, kidState } = getKidState();
    if (!kidId) {
      viewContent.innerHTML = `
        <div class="p-6 bg-white rounded-3xl shadow-md">
          <p class="font-bold text-gray-800">請先到「設定」新增小朋友。</p>
        </div>`;
      return;
    }
  
    ensureEggSlots(kidId, kidState);
  
    const kid = (state.kids || []).find((k) => k.id === kidId) || {};
    const points = Number(kidState.points ?? 0);
    const eggSlots = Array.isArray(kidState.eggSlots) ? kidState.eggSlots : [];
    const hatched = calcHatchedCount(eggSlots);
    const unhatched = TOTAL_EGGS - hatched;
    const availableHatches = calcAvailableHatches(points, hatched);
    const needNext = pointsToNextUnlock(points);
  
    const cards = eggSlots.map((slot, idx) => {
      const s = slot || { status: "unhatched" };
      const isHatched = s.status === "hatched";
      const canHatch = !isHatched && availableHatches > 0 && !isHatching;
  
      if (isHatched && s.spirit) {
        return `
          <button
            class="text-left bg-white rounded-2xl shadow-md border-2 border-success/40 p-3 hover:shadow-lg transition"
            onclick="window.openSpirit(${idx})"
            aria-label="已孵化精靈"
          >
            <div class="w-full aspect-square bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden">
              <img src="${escapeHtml(s.spirit.img || "")}" alt="${escapeHtml(s.spirit.name || "精靈")}" class="w-full h-full object-contain" onerror="this.style.display='none'">
              <div class="text-3xl ${s.spirit.img ? "hidden" : ""}">✨</div>
            </div>
            <div class="mt-2">
              <div class="font-black text-primary text-sm truncate">${escapeHtml(s.spirit.name || "神秘精靈")}</div>
              <div class="text-xs text-gray-500 truncate">已孵化（點看故事）</div>
            </div>
          </button>
        `;
      }
  
      return `
        <button
          class="text-left rounded-2xl shadow-md border-2 p-3 transition
            ${canHatch ? "bg-white border-accent hover:shadow-lg" : "bg-gray-100 border-gray-200 opacity-90"}
          "
          onclick="window.hatchEgg(${idx})"
          ${canHatch ? "" : "disabled"}
          aria-label="未孵化蛋"
        >
          <div class="w-full aspect-square bg-white rounded-xl flex items-center justify-center overflow-hidden">
            <img src="${IMG_EGG}" alt="egg" class="w-full h-full object-contain" onerror="this.style.display='none'">
            <div class="text-4xl ${IMG_EGG ? "hidden" : ""}">🥚</div>
          </div>
          <div class="mt-2">
            <div class="font-black text-gray-800 text-sm">未孵化</div>
            <div class="text-xs ${canHatch ? "text-success font-bold" : "text-gray-500"}">
              ${canHatch ? "可以孵化！點一下" : (needNext === 0 ? "先去做任務拿點數" : `再差 ${needNext} 點解鎖下一次孵化`)}
            </div>
          </div>
        </button>
      `;
    }).join("");
  
    viewContent.innerHTML = `
      <style>
        .egg-shake { animation: eggShake 0.9s ease-in-out both; }
        @keyframes eggShake {
          0% { transform: translateY(0) rotate(0deg) scale(1); }
          20% { transform: translateY(-2px) rotate(-5deg) scale(1.02); }
          40% { transform: translateY(2px) rotate(6deg) scale(1.03); }
          60% { transform: translateY(-3px) rotate(-7deg) scale(1.03); }
          80% { transform: translateY(2px) rotate(6deg) scale(1.02); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        .spirit-pop { animation: spiritPop 0.55s cubic-bezier(.2,1.2,.2,1) both; }
        @keyframes spiritPop {
          0% { transform: translateY(20px) scale(0.2); opacity: 0; }
          60% { transform: translateY(-6px) scale(1.08); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      </style>
  
      <div class="pb-28">
        <div class="bg-white p-5 rounded-3xl shadow-xl border-4 border-primary/10 mb-5">
          <h2 class="text-2xl font-black text-primary mb-2">🥚 精靈孵化屋</h2>
  
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <div class="min-w-0">
              <p class="text-gray-700">小朋友：<span class="font-bold">${escapeHtml(kid.nickname || "小朋友")}</span></p>
              <p class="text-sm text-gray-500 mt-1">每累積 <span class="font-bold">${HATCH_STEP}</span> 點，可解鎖 <span class="font-bold">1 次孵化</span>（點數不扣除）</p>
            </div>
  
            <div class="flex flex-wrap gap-2">
              <div class="px-4 py-2 rounded-2xl bg-secondary/10 text-secondary font-black">🪙 點數：${points}</div>
              <div class="px-4 py-2 rounded-2xl bg-success/10 text-success font-black">✅ 已孵化：${hatched}</div>
              <div class="px-4 py-2 rounded-2xl bg-gray-100 text-gray-700 font-black">🥚 未孵化：${unhatched}</div>
              <div class="px-4 py-2 rounded-2xl ${availableHatches > 0 ? "bg-success/10 text-success" : "bg-orange-100 text-orange-600"} font-black">
                ⚡ 可孵化：${availableHatches}
              </div>
            </div>
          </div>
  
          <div class="mt-3 text-sm ${availableHatches > 0 ? "text-success" : "text-gray-500"} font-semibold">
            ${availableHatches > 0 ? "太棒了！你已解鎖孵化次數，快點一顆蛋看看！" : (needNext === 0 ? "再去完成任務拿點數，就能解鎖孵化！" : `距離下一次孵化解鎖還差 ${needNext} 點`) }
          </div>
        </div>
  
        <h3 class="text-xl font-extrabold text-gray-800 mb-3">20 顆蛋（可孵化的蛋會亮起）</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          ${cards}
        </div>
      </div>
    `;
  }
  
  window.openSpirit = (idx) => {
    stopSpeaking();
    const { kidState } = getKidState();
    const slot = (kidState.eggSlots || [])[idx];
    if (!slot || slot.status !== "hatched" || !slot.spirit) return;
  
    const s = slot.spirit;
    showModal(
      "✨ 精靈故事",
      `
        <div class="text-center">
          <div class="mx-auto w-44 h-44 bg-gray-50 rounded-3xl shadow-inner flex items-center justify-center overflow-hidden">
            <img src="${escapeHtml(s.img || "")}" alt="${escapeHtml(s.name || "精靈")}" class="w-full h-full object-contain" onerror="this.style.display='none'">
            <div class="text-5xl ${s.img ? "hidden" : ""}">✨</div>
          </div>
  
          <p class="mt-4 text-2xl font-black text-primary">${escapeHtml(s.name || "神秘精靈")}</p>
          <p class="mt-2 text-gray-700 text-left leading-relaxed">${escapeHtml(s.desc || "")}</p>
  
          <button onclick="window.speakSpirit(${idx})" class="mt-4 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90">🔊 聽故事</button>
        </div>
      `,
      "關閉",
      () => closeModal()
    );
  };
  
  window.speakSpirit = (idx) => {
    const { kidState } = getKidState();
    const text = (kidState.eggSlots || [])[idx]?.spirit?.desc || "";
    if (!text) return;
    speakText(text);
  };
  
  window.hatchEgg = async (idx) => {
    stopSpeaking();
    if (isHatching) return;
  
    const { kidId, kidState } = getKidState();
    if (!kidId) return;
  
    ensureEggSlots(kidId, kidState);
  
    const points = Number(kidState.points ?? 0);
    const eggSlots = Array.isArray(kidState.eggSlots) ? kidState.eggSlots : [];
    const slot = eggSlots[idx];
  
    if (!slot || slot.status === "hatched") {
      showToast("這顆蛋已經孵化過囉！", "info");
      return;
    }
  
    const hatched = calcHatchedCount(eggSlots);
    const availableHatches = calcAvailableHatches(points, hatched);
  
    if (availableHatches <= 0) {
      const need = pointsToNextUnlock(points);
      showToast(need === 0 ? "去完成任務拿點數，就能解鎖孵化！" : `還差 ${need} 點解鎖下一次孵化`, "info");
      return;
    }
  
    isHatching = true;
    renderSpiritsContent();
  
    playSfx(SFX_CRACK);
  
    showModal(
      "🥚 蛋殼裂開中...",
      `
        <div class="text-center">
          <div class="mx-auto w-44 h-44 bg-gray-50 rounded-3xl shadow-inner flex items-center justify-center overflow-hidden">
            <img src="${IMG_EGG_CRACK}" class="w-full h-full object-contain egg-shake" onerror="this.style.display='none'">
            <div class="text-6xl ${IMG_EGG_CRACK ? "hidden" : ""} egg-shake">🥚</div>
          </div>
          <p class="mt-4 text-gray-700 font-bold">咔嚓…咔嚓…</p>
          <p class="text-sm text-gray-500">快要孵化成功了！</p>
        </div>
      `,
      "稍等一下",
      () => {}
    );
  
    setTimeout(async () => {
      try {
        const spirit = pickRandomSpirit();
  
        const newSlot = {
          status: "hatched",
          hatchedAt: Date.now(),
          spirit: { id: spirit.id, name: spirit.name, img: spirit.img, desc: spirit.desc },
        };
  
        const newEggSlots = eggSlots.slice();
        newEggSlots[idx] = newSlot;
  
        // Points NOT deducted
        await setDoc(getKidStateDocRef(kidId), { eggSlots: newEggSlots }, { merge: true });
  
        // optimistic update
        state.kidData[kidId] = { ...(kidState || {}), eggSlots: newEggSlots };
  
        playSfx(SFX_SUCCESS);
  
        showModal(
          "🎉 孵化成功！",
          `
            <div class="text-center">
              <div class="mx-auto w-44 h-44 bg-gray-50 rounded-3xl shadow-inner flex items-center justify-center overflow-hidden">
                <img src="${escapeHtml(spirit.img || "")}" class="w-full h-full object-contain spirit-pop" onerror="this.style.display='none'">
                <div class="text-6xl ${spirit.img ? "hidden" : ""} spirit-pop">✨</div>
              </div>
              <p class="mt-4 text-2xl font-black text-primary">${escapeHtml(spirit.name || "神秘精靈")}</p>
              <p class="mt-2 text-gray-700 text-left leading-relaxed">${escapeHtml(spirit.desc || "")}</p>
  
              <button onclick="window.speakTextFromHatch('${escapeHtml(spirit.desc || "")}')" class="mt-4 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90">🔊 聽故事</button>
            </div>
          `,
          "回到列表",
          () => {
            closeModal();
            isHatching = false;
            renderSpiritsContent();
          }
        );
  
        isHatching = false;
        renderSpiritsContent();
      } catch (e) {
        console.error(e);
        showToast(`孵化失敗: ${e?.message || e}`, "danger");
        isHatching = false;
        closeModal();
        renderSpiritsContent();
      }
    }, 900);
  };
  
  window.speakTextFromHatch = (text) => {
    if (!text) return;
    speakText(text);
  };
  
  initPage(renderSpiritsContent, "spirits");
  
  