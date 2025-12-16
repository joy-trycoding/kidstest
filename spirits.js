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
        desc: "小緋誕生在春天第一朵櫻花綻放的清晨，花瓣落下時會變成勇氣的粉光。當你害怕或想放棄，她會在你肩上輕輕跳一下，提醒你先做一步就好。每完成一個小任務，她就會開出一朵新的花。"
      },
      {
        id: "flower",
        name: "萌花草精靈",
        img: "assets/spirits/flower.png",
        desc: "萌花住在草地最柔軟的角落，喜歡把微小的努力種成大大的成就。她的花環會記住你每天的好習慣，並在你累的時候送出清新的香氣。只要你願意再試一次，萌花就會幫你把心情慢慢變亮。"
      },
      {
        id: "moon",
        name: "銀月精靈",
        img: "assets/spirits/moon.png",
        desc: "銀月是夜晚的守護者，會把安靜變成力量。當你需要專心寫字、收玩具或準備睡覺時，他會撒下銀色月光，讓雜念像泡泡一樣飄走。每天睡前若完成任務，他就會替你把夢整理得更溫柔。"
      },
      {
        id: "fire",
        name: "烈焰精靈",
        img: "assets/spirits/fire.png",
        desc: "烈焰像小小火炬一樣熱情，他最討厭拖延和嘟囔。當你動起來，他的火焰會變成橘紅色的加速光，讓你越做越快。遇到難題時，烈焰會教你先把事情分成三步，做完第一步就能燃起信心。"
      },
      {
        id: "leaf",
        name: "風葉精靈",
        img: "assets/spirits/leaf.png",
        desc: "風葉懂得慢慢來的厲害，他住在樹梢，會把焦躁吹成舒服的風。當你覺得事情好多，他會提醒你先整理桌面、再整理心。每完成一次收納或家務，風葉就會送你一片綠葉徽章，代表你變得更自律。"
      },
      {
        id: "silver",
        name: "閃銀精靈",
        img: "assets/spirits/silver.png",
        desc: "閃銀是金屬光芒的守護者，眼睛像星星一樣亮。他喜歡把規則變成遊戲，讓你知道努力會被看見。當你完成任務，他會在空中畫出銀色軌跡，像給你一條勝利跑道。走完跑道，你就會更相信自己可以。"
      },
      {
        id: "unicorn",
        name: "獨角獸精靈",
        img: "assets/spirits/unicorn.png",
        desc: "獨角獸最擅長把壞心情變成彩色泡泡。當你哭哭或生氣時，她會用角尖碰一下你的額頭，讓你記得深呼吸、說出需要。她相信溫柔也很勇敢，所以每次你用禮貌表達或願意道歉，她都會送你一束彩虹光。"
      },
      {
        id: "star",
        name: "星宿精靈",
        img: "assets/spirits/star.png",
        desc: "星宿負責替努力的人點亮天空。他會把你完成的任務變成一顆顆星星，排成只有你看得懂的星圖。當你覺得今天不夠好，他會指給你看那些已經做到的部分。星圖越亮，代表你正在一點一滴變強。"
      },
      {
        id: "rose",
        name: "玫瑰精靈",
        img: "assets/spirits/rose.png",
        desc: "玫瑰精靈外表美麗，內心卻非常堅定。她教你做事要有界線：先完成該做的，再去玩喜歡的。當你願意收拾自己的物品或把事情做完，她就會長出更深的玫瑰紅。她說：真正的酷，是把自己照顧好。"
      },
      {
        id: "wind",
        name: "風谷精靈",
        img: "assets/spirits/wind.png",
        desc: "風谷總是在你最卡的時候出現，他會把複雜的事情吹成簡單的方向。你只要選一件先做，他就會替你把下一步的路吹出來。當你完成日常任務，他會送你一段清爽的風聲，像在耳邊說：做得好，再來一次！"
      },
      {
        id: "sound",
        name: "音符精靈",
        img: "assets/spirits/sound.png",
        desc: "音符精靈住在旋律裡，最喜歡把努力配上節拍。當你刷牙、整理或閱讀時，他會在旁邊敲出輕快的拍子，讓你越做越順。若你分心了，他會用短短的叮咚聲提醒你回來。完成任務時，他會送上一段勝利小樂句。"
      },
      {
        id: "story",
        name: "故事精靈",
        img: "assets/spirits/story.png",
        desc: "故事精靈會把你每天的小任務寫成冒險篇章。你完成一件事，就等於翻開一頁新劇情。當你覺得無聊，他會偷偷加一個驚喜彩蛋，讓你期待下一次的挑戰。故事精靈相信：每個孩子都能當主角，而主角靠行動變強。"
      },
      {
        id: "hope",
        name: "希望精靈",
        img: "assets/spirits/hope.png",
        desc: "希望精靈像一盞小燈，專門照亮你快要放棄的瞬間。她不會催你，而是陪你把任務拆成很小很小的步驟。只要你完成其中一小步，她就會更亮一點。她常說：不是要一次做完全部，而是每天都往前一點點。"
      },
      {
        id: "sun",
        name: "太陽精靈",
        img: "assets/spirits/sun.png",
        desc: "太陽精靈喜歡早起的光，他會把早晨變成能量補給站。當你準時起床、整理書包或按表完成任務，他就會送你一圈溫暖的金光盾牌，讓你整天更有精神。太陽精靈說：規律不是限制，是讓你有更多時間玩和做喜歡的事。"
      },
      {
        id: "color",
        name: "Lulu小精靈",
        img: "assets/spirits/color.png",
        desc: "露露誕生於雨後的霓虹，是白雲與森林水氣結晶而成的精靈。她溫柔且富同情心，揮動翅膀會灑下療癒金色粒子，幫助受損的森林復原。任務遇到困難時，露露以彩虹光引路，讓恐懼在光影中消散。"
      },
      {
        id: "water",
        name: "晨露小精靈",
        img: "assets/spirits/water.png",
        desc: "晨露像清晨的第一滴水，溫柔又聰明。當你太急或太生氣，她會讓你先停一下、喝口水、再重新開始。她最擅長把混亂變清楚，教你一步一步完成。每當你用冷靜的方式把事情做好，晨露就會在你身邊亮起透明藍光，鼓勵你更穩。"
      },
      {
        id: "shine",
        name: "耀星精靈",
        img: "assets/spirits/shine.png",
        desc: "閃閃是能量與行動力的化身，總在森林電路間快速穿梭。孩子展現效率時，他的尾巴會發出藍光為森林補電。雖然調皮卻很正義，喜歡整理混亂的數據角落。有了閃閃陪伴，任務像賽跑一樣刺激，你會越做越有衝勁。"
      },
      {
        id: "wood",
        name: "月木精靈",
        img: "assets/spirits/wood.png",
        desc: "月葉是森林的時間守護者，總是安靜地看著你努力。當你需要專注，他會輕搖樹葉，讓時間流動變得柔和，幫助你不被打擾。完成閱讀或寫作任務時，月葉會送你一片發光的葉子，提醒你：專注不是天生，是每天練出來的能力。"
      },
      {
        id: "time",
        name: "時間精靈",
        img: "assets/spirits/time.png",
        desc: "時間精靈有一個看不見的小沙漏，會把拖延偷偷收走。當你開始做事，他會讓每一分鐘都變得更有用；當你分心，他會輕聲提醒你回到現在。只要你願意先做五分鐘，時間精靈就會把五分鐘變成十倍成果，讓你更快完成任務。"
      },
      {
        id: "light",
        name: "熱情精靈",
        img: "assets/spirits/light.png",
        desc: "閃耀是光之守護者，喜歡在你完成任務的瞬間放出一束亮光。他會把努力變成可看見的榮耀，讓你知道自己真的做到了。當你需要專心，他會把周圍變得更明亮；當你成功，他會用金光在空中畫出小獎盃。閃耀說：熱情會傳染，先點亮自己。"
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
  
  
  