(function () {
  if (document.getElementById("browser-pet-root")) return;

  const PETS = [
    {
      id: "cat", emoji: "🐱", name: "Neko",
      idle: ["เมี๊ยว~", "สวัสดี!", "*ยืดตัว*", "วันนี้เป็นยังไงบ้าง?", "ง่วงนอนจัง..."],
      poked: ["เมี๊ยวว!!", "อย่าแกล้งฉันสิ!", "เจ็บ! >.<", "หยุดนะ!", "*ขู่*", "เดี๋ยวข่วนนะ!"],
      grabbed: ["วางฉันลงด้วย!", "หมุนเวียนหัว...", "เฮ้ย!", "ปล่อยฉันที!"],
      thrown: ["ว้าย~~!", "โอ้โห!!", "*ลอยฟ้า*", "เมี๊ยวว~~~"],
      land: ["เจ็บ...", "ฉันโอเคนะ", "*ตบฝุ่น*", "ทำไมต้องทำแบบนี้ด้วย"]
    },
    {
      id: "dog", emoji: "🐶", name: "Buddy",
      idle: ["Woof!", "*โบกหาง*", "ดีใจที่เจอ!", "*วิ่งวนๆ*", "เฮ้!"],
      poked: ["Ouch!", "เฮ้ย!", "*หลบ*", "ทำอะไรเนี่ย!", "บาร์ค!"],
      grabbed: ["ว้าว ลอยได้ด้วย!", "เฮ้ย วางผมลงด้วย!", "*หางห้อย*"],
      thrown: ["Wooooof~~!", "*บินแล้ว*", "เย้~"],
      land: ["อุ้ย!", "โอเค ไม่เป็นไร", "*สลัดตัว*"]
    },
    {
      id: "frog", emoji: "🐸", name: "Froggy",
      idle: ["Ribbit~", "*กระโดด*", "ว้าว!", "*ขยิบตา*", "อยู่นะๆ"],
      poked: ["Ribbit!!", "อย่าแกล้งกบ!", "*กระโดดหนี*", "เจ็บ!"],
      grabbed: ["กบลอยได้แล้ว!", "*ขาเตะ*", "วางลงเดี๋ยวนี้!"],
      thrown: ["Ribbiiiit~~~", "*บินข้ามบึง*"],
      land: ["ตกน้ำแล้ว!", "โอ้ย...", "*ขาสั่น*"]
    },
    {
      id: "fox", emoji: "🦊", name: "Kitsune",
      idle: ["*ส่ายหาง*", "ฉลาดและเร็ว!", "มาเล่นกัน", "หน้านี้ดูดี"],
      poked: ["กร้าว!", "*กัด*", "อย่าแตะฉัน!", "เจ็บ!! >:("],
      grabbed: ["ปล่อยหางฉัน!", "*ส่ายหางแรงๆ*", "เฮ้ย!"],
      thrown: ["ว้าย~~!", "*หางปลิว*", "จิ้งจอกบิน!"],
      land: ["ฉลาดพอลงจอดได้", "*ทำท่าเท่*", "ตั้งใจทำแบบนี้"]
    },
    {
      id: "penguin", emoji: "🐧", name: "Tux",
      idle: ["*แกว่งตัว*", "เพนกวินมาแล้ว!", "*โบกครีบ*", "Linux!"],
      poked: ["Squawk!", "*ครีบตี*", "อุ้ย!", "เพนกวินไม่พอใจ!"],
      grabbed: ["*ครีบดิ้น*", "เพนกวินบินได้แล้ว!", "เฮ้ย!"],
      thrown: ["Squawwwk~~~", "*ร่อนไปข้างหน้า*"],
      land: ["เพนกวินแข็งแกร่ง!", "*ลุกขึ้น*", "โอ้ย..."]
    },
  ];

  let petId = "cat", enabled = true, apiKey = "", provider = "claude", model = "", language = "th";
  let ytRemoteTabId = null;
  // Walk/idle tuning — reduce walking dramatically to keep pet mostly still
  const WALK_SPEED = 0.01;                 // very slow horizontal speed
  const WALK_IDLE_PROBABILITY = 0.08;      // chance per tick to go idle (higher = more idle)
  const IDLE_DURATION_MIN = 5000;          // idle lasts 5-10s
  const IDLE_DURATION_EXTRA = 5000;
  const THROW_SPEED_FACTOR = 0.5;
  const LAND_WALK_SPEED_FACTOR = 0.2;
  const LANDED_WALK_THRESHOLD = 0.2;
  const MIN_THROW_SPEED = 0.5;
  const GRAVITY = 0.8;
  const GROUND = 8;    // bottom offset px
  const BOUNCE = 0.2;
  let x = 120, y = 0;   // y = ระยะจากพื้น (0 = บนพื้น)
  let vx = WALK_SPEED, vy = 0; // velocity

  let state = "walk";   // walk | idle | grabbed | thrown | poked
  let bubbleTimer = null;
  let persistentBubble = false; // when true, ignore non-persistent say() calls
  let inputOpen = false;

  // drag state
  let dragging = false;
  let dragOffX = 0, dragOffY = 0;
  let lastDragX = 0, lastDragY = 0;
  let lastDragT = 0;
  let throwVX = 0, throwVY = 0;

  // poke state
  let pokeCount = 0;
  let pokeTimer = null;

  // ---- DOM ----
  const root = document.createElement("div");
  root.id = "browser-pet-root";

  const petEl = document.createElement("div");
  petEl.className = "bp-pet";
  // ตั้งตำแหน่งเริ่มต้นก่อน append เพื่อไม่ให้กระพริบที่ซ้ายบน
  petEl.style.setProperty("left", Math.round(x) + "px", "important");
  petEl.style.setProperty("bottom", Math.round(y + GROUND) + "px", "important");

  const sprite = document.createElement("span");
  sprite.className = "bp-sprite";
  sprite.textContent = "🐱";

  const closeBtn = document.createElement("button");
  closeBtn.className = "bp-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.title = "ซ่อนสัตว์เลี้ยง";
  closeBtn.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    enabled = false;
    root.style.display = "none";
    saveSettings();
  });

  const bubble = document.createElement("div");
  bubble.className = "bp-bubble";

  const inputWrap = document.createElement("div");
  inputWrap.className = "bp-input-wrap";

  // Container for text input + send button
  const formRow = document.createElement("div");
  formRow.className = "bp-form-row";

  const inputEl = document.createElement("input");
  inputEl.className = "bp-input";
  inputEl.placeholder = "ถามอะไรก็ได้...";
  inputEl.type = "text";
  const sendBtn = document.createElement("button");
  sendBtn.className = "bp-send";
  sendBtn.textContent = "ส่ง";

  formRow.appendChild(inputEl);
  formRow.appendChild(sendBtn);

  const noKeyMsg = document.createElement("div");
  noKeyMsg.className = "bp-nokey";
  noKeyMsg.textContent = "กด 🐾 ที่ toolbar เพื่อใส่ API key";

  // Create action buttons for PAGE_AI actions
  const actionRow = document.createElement("div");
  actionRow.className = "bp-action-row";

  const sumBtn = document.createElement("button");
  sumBtn.className = "bp-action-btn";
  sumBtn.textContent = "📝 สรุปหน้านี้";

  const groupBtn = document.createElement("button");
  groupBtn.className = "bp-action-btn";
  groupBtn.textContent = "📁 จัดกลุ่มแท็บ";

  const musicBtn = document.createElement("button");
  musicBtn.className = "bp-action-btn";
  musicBtn.textContent = "🎵 ควบคุมเพลง";

  actionRow.appendChild(sumBtn);
  actionRow.appendChild(groupBtn);
  actionRow.appendChild(musicBtn);

  inputWrap.appendChild(formRow);
  inputWrap.appendChild(actionRow);
  inputWrap.appendChild(noKeyMsg);
  petEl.appendChild(bubble);
  petEl.appendChild(inputWrap);
  petEl.appendChild(sprite);
  petEl.appendChild(closeBtn);
  root.appendChild(petEl);
  document.body.appendChild(root);

  // ---- Helpers ----
  const getPet = () => PETS.find(p => p.id === petId) || PETS[0];
  const hasKey = () => apiKey && apiKey.trim().length > 8;
  const maxX = () => window.innerWidth - 60;
  const maxY = () => window.innerHeight - 90; // สูงสุดที่โยนได้

  function say(pool) {
    // pool: array of possible texts. Optional second arg 'persist' marks bubble as persistent.
    const args = Array.from(arguments);
    const persist = !!args[1];
    if (persistentBubble && !persist) return; // don't override a persistent message
    const text = pool[Math.floor(Math.random() * pool.length)];
    bubble.textContent = text;
    bubble.className = "bp-bubble show";
    clearTimeout(bubbleTimer);
    if (persist) {
      persistentBubble = true;
      // do not auto-hide
    } else {
      bubbleTimer = setTimeout(() => bubble.classList.remove("show"), 3200);
    }
  }

  function hideBubble() { clearTimeout(bubbleTimer); bubble.classList.remove("show"); persistentBubble = false; }

  function positionPet() {
    // x = left, y = ระยะจากด้านล่าง viewport
    petEl.style.setProperty("left", Math.round(x) + "px", "important");
    petEl.style.setProperty("bottom", Math.round(y + GROUND) + "px", "important");
  }

  // Set initial placeholders to support English if saved
  function updateInputLanguage() {
    if (language === "en") {
      inputEl.placeholder = "Ask anything...";
      sendBtn.textContent = "Send";
      noKeyMsg.textContent = "Click 🐾 on toolbar to enter API key";
      sumBtn.textContent = "📝 Summarize Page";
      groupBtn.textContent = "📁 Group Tabs";
      musicBtn.textContent = "🎵 Music Control";
    } else {
      inputEl.placeholder = "ถามอะไรก็ได้...";
      sendBtn.textContent = "ส่ง";
      noKeyMsg.textContent = "กด 🐾 ที่ toolbar เพื่อใส่ API key";
      sumBtn.textContent = "📝 สรุปหน้านี้";
      groupBtn.textContent = "📁 จัดกลุ่มแท็บ";
      musicBtn.textContent = "🎵 ควบคุมเพลง";
    }
  }

  function setAnim(cls) {
    petEl.className = "bp-pet " + cls;
  }

  function saveSettings() {
    try {
      chrome.storage.sync.set({ petSettings: { petId, enabled, provider, model, language } });
      chrome.storage.local.set({ petApiKey: apiKey });
    } catch (e) { }
  }

  // ---- Load settings ----
  try {
    chrome.storage.sync.get(["petSettings"], (syncRes) => {
      if (chrome.runtime.lastError) return;
      chrome.storage.local.get(["petApiKey"], (localRes) => {
        if (syncRes && syncRes.petSettings) {
          const s = syncRes.petSettings;
          if (s.petId) petId = s.petId;
          if (s.provider) provider = s.provider;
          if (s.model) model = s.model;
          if (s.language) language = s.language;
          enabled = s.enabled !== false;
          // migrate legacy apiKey from sync → local (one-time)
          if (s.apiKey && !localRes.petApiKey) {
            chrome.storage.local.set({ petApiKey: s.apiKey });
          }
        }
        apiKey = localRes.petApiKey || "";
        sprite.textContent = getPet().emoji;
        root.style.display = enabled ? "" : "none";
        updateInputLanguage();
      });
    });
  } catch (e) { }

  // ---- Physics loop ----
  let lastT = 0;
  const onGround = () => y <= 0;

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!enabled || dragging) {
      lastT = ts; // keep lastT fresh so dt isn't huge on resume
      return;
    }
    const dt = Math.min(ts - lastT, 50);
    lastT = ts;

    if (state === "thrown") {
      // physics
      vy -= GRAVITY * (dt / 16);
      x += vx * (dt / 16);
      y += vy * (dt / 16);

      // ชนขอบ
      if (x < 0) { x = 0; vx = Math.abs(vx) * 0.7; }
      if (x > maxX()) { x = maxX(); vx = -Math.abs(vx) * 0.7; }

      // ลงพื้น
      if (y <= 0) {
        y = 0;
        if (vy < -BOUNCE * 60) {
          // กระดอนเล็กน้อย
          vy = Math.abs(vy) * BOUNCE;
        } else {
          vy = 0;
          if (Math.abs(vx) > LANDED_WALK_THRESHOLD) {
            vx *= LAND_WALK_SPEED_FACTOR;
            say(getPet().land);
            state = "walk";
            setAnim(vx > 0 ? "walk-r" : "walk-l");
          } else {
            vx = 0;
            say(getPet().land);
            goIdle();
          }
        }
      }
      positionPet();
      return;
    }

    if (state === "walk") {
      x += vx * (dt / 16);
      if (x >= maxX()) { x = maxX(); vx = -Math.abs(vx); setAnim("walk-l"); }
      if (x <= 0) { x = 0; vx = Math.abs(vx); setAnim("walk-r"); }
      if (Math.random() < WALK_IDLE_PROBABILITY) goIdle();
      if (Math.random() < 0.0001) say(getPet().idle);
    }

    positionPet();
  }

  function goIdle() {
    state = "idle";
    setAnim("idle");
    if (Math.random() < 0.15) say(getPet().idle);
    setTimeout(() => {
      if (state !== "idle") return;
      state = "walk";
      // reset to a very slow walk in a random direction
      vx = WALK_SPEED * (Math.random() < 0.5 ? 1 : -1);
      setAnim(vx > 0 ? "walk-r" : "walk-l");
    }, IDLE_DURATION_MIN + Math.random() * IDLE_DURATION_EXTRA);
  }

  // ---- Drag ----
  function startDrag(clientX, clientY) {
    if (inputOpen) return;
    dragging = true;
    state = "grabbed";
    setAnim("grabbed");
    say(getPet().grabbed);

    const rect = petEl.getBoundingClientRect();
    dragOffX = clientX - rect.left;
    dragOffY = clientY - rect.top;
    lastDragX = clientX;
    lastDragY = clientY;
    lastDragT = Date.now();
    throwVX = 0; throwVY = 0;

    document.body.style.userSelect = "none";
  }

  function moveDrag(clientX, clientY) {
    if (!dragging) return;
    const now = Date.now();
    const dt = now - lastDragT || 1;

    // velocity สำหรับโยน
    throwVX = (clientX - lastDragX) / dt * 16;
    throwVY = (clientY - lastDragY) / dt * 16;
    lastDragX = clientX; lastDragY = clientY; lastDragT = now;

    // แปลง clientX/Y → x (left) และ y (bottom)
    x = clientX - dragOffX;
    y = window.innerHeight - clientY - dragOffY - GROUND;
    x = Math.max(0, Math.min(maxX(), x));
    y = Math.max(0, y);
    positionPet();
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = "";

    const speed = Math.sqrt(throwVX * throwVX + throwVY * throwVY);
    if (speed > MIN_THROW_SPEED) {
      // โยน!
      state = "thrown";
      vx = throwVX * THROW_SPEED_FACTOR;
      vy = -throwVY * THROW_SPEED_FACTOR; // canvas y กลับกับ screen y
      setAnim("thrown");
      say(getPet().thrown);
    } else {
      // วางลงเฉยๆ
      if (y <= 0) {
        y = 0;
        goIdle();
      } else {
        // ตกลงมาจากกลางอากาศ
        state = "thrown";
        setAnim("thrown");
        vx = 0;
        vy = -1; // เริ่มตก — gravity จะดึงให้ตกเร็วขึ้นเรื่อยๆ
      }
    }
  }

  // Mouse events บน pet
  petEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // ถ้าคลิกเร็วๆ = แกล้ง (poke)
    clearTimeout(pokeTimer);
    pokeTimer = setTimeout(() => {
      if (!dragging) {
        // poke!
        pokeCount++;
        setAnim("poked");
        say(getPet().poked);
        petEl.style.transform = "scale(0.85)";
        setTimeout(() => {
          petEl.style.transform = "";
          if (state === "poked") {
            state = "walk";
            setAnim(vx > 0 ? "walk-r" : "walk-l");
          }
        }, 300);
        state = "poked";
      }
    }, 150); // ถ้า hold นานกว่า 150ms = drag

    // เริ่ม drag
    const holdTimer = setTimeout(() => {
      clearTimeout(pokeTimer);
      startDrag(e.clientX, e.clientY);
    }, 150);

    // ถ้า mouseup เร็ว = poke ไม่ใช่ drag
    const onUp = () => {
      clearTimeout(holdTimer);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mouseup", onUp);
  });

  document.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
  document.addEventListener("mouseup", () => endDrag());

  // Touch events
  petEl.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, { passive: false });

  document.addEventListener("touchend", () => endDrag());

  // ---- Click (ไม่ใช่ drag) → เปิด chat ----
  petEl.addEventListener("click", (e) => {
    if (dragging) return;
    e.stopPropagation();
    // if an AI reply is being shown persistently, clicking the pet dismisses it for reading
    if (persistentBubble) { hideBubble(); return; }
    if (inputOpen) { closeInput(); return; }
    openInput();
  });

  function openInput() {
    inputOpen = true;
    hideBubble();
    if (hasKey()) {
      formRow.style.display = "flex";
      actionRow.style.display = "flex";
      noKeyMsg.style.display = "none";
      setTimeout(() => inputEl.focus(), 60);
    } else {
      formRow.style.display = "none";
      actionRow.style.display = "none";
      noKeyMsg.style.display = "block";
      if (Math.random() < 0.2) say(getPet().idle);
    }
    inputWrap.classList.add("show");
  }

  function closeInput() {
    inputOpen = false;
    inputWrap.classList.remove("show");
    inputEl.value = "";
  }

  document.addEventListener("click", () => { if (inputOpen) closeInput(); });

  sumBtn.addEventListener("click", () => {
    const loaderMsg = language === "en" ? "Summarizing page..." : "กำลังสรุปหน้าเว็บ...";
    handlePageAction("summarize", loaderMsg);
  });
  groupBtn.addEventListener("click", () => {
    const loaderMsg = language === "en" ? "Analyzing and grouping tabs..." : "กำลังวิเคราะห์และจัดกลุ่มแท็บ...";
    handlePageAction("group_tabs", loaderMsg);
  });

  function handlePageAction(action, thinkingMsg, options = {}) {
    closeInput();
    bubble.textContent = thinkingMsg;
    bubble.className = "bp-bubble show thinking";
    try {
      chrome.runtime.sendMessage(
        { type: "PAGE_AI", action, options, settings: { apiKey, provider, model, language } },
        (res) => {
          if (res && res.reply) say([res.reply], true);
          else say([language === "en" ? "An error occurred, please try again!" : "เกิดข้อผิดพลาด ลองใหม่นะ!"]);
        }
      );
    } catch (e) { say([language === "en" ? "Please reload this page first" : "ลอง reload หน้านี้ก่อนนะ"]); }
  }

  sendBtn.addEventListener("click", sendMsg);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMsg();
    if (e.key === "Escape") closeInput();
  });

  function sendMsg() {
    const text = inputEl.value.trim();
    if (!text) return;
    closeInput();
    bubble.textContent = language === "en" ? "Thinking..." : "กำลังคิด...";
    bubble.className = "bp-bubble show thinking";
    try {
      chrome.runtime.sendMessage(
        {
          type: "ASK_AI", text, pageContext: `${document.title} · ${location.hostname}`,
          settings: { apiKey, provider, model, language }
        },
        (res) => {
          if (res && res.reply) say([res.reply], true);
          else say([language === "en" ? "An error occurred, please try again!" : "เกิดข้อผิดพลาด ลองใหม่นะ!"]);
        }
      );
    } catch (e) { say([language === "en" ? "Please reload this page first" : "ลอง reload หน้านี้ก่อนนะ"]); }
  }

  // ---- Extension messages ----
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === "GET_PAGE_CONTENT") {
        try {
          const selection = window.getSelection ? window.getSelection().toString().trim() : "";
          const meta = document.querySelector('meta[name="description"]')?.getAttribute('content') || "";
          let text = selection || document.body.innerText || document.documentElement.innerText || "";
          text = text.replace(/\s+/g, ' ').trim();
          const MAX = 18000;
          if (text.length > MAX) text = text.slice(0, MAX) + "\n\n...[truncated]";
          sendResponse({ title: document.title, url: location.href, selection, metaDescription: meta, text });
        } catch (e) { sendResponse({ error: e.message }); }
        return true;
      }
      if (msg.type === "TOGGLE") {
        enabled = !enabled;
        root.style.display = enabled ? "" : "none";
        saveSettings();
      }
      if (msg.type === "SET_PET") {
        petId = msg.pet;
        sprite.textContent = getPet().emoji;
        if (Math.random() < 0.25) say(getPet().idle);
        saveSettings();
      }
      if (msg.type === "RELOAD_SETTINGS") {
        try {
          chrome.storage.sync.get(["petSettings"], (syncRes) => {
            chrome.storage.local.get(["petApiKey"], (localRes) => {
              if (syncRes && syncRes.petSettings) {
                const s = syncRes.petSettings;
                if (s.petId) petId = s.petId;
                if (s.provider) provider = s.provider;
                if (s.model) model = s.model;
                if (s.language) language = s.language;
                enabled = s.enabled !== false;
              }
              apiKey = localRes.petApiKey || "";
              sprite.textContent = getPet().emoji;
              root.style.display = enabled ? "" : "none";
              updateInputLanguage();
            });
          });
        } catch (e) { }
      }

      if (msg.type === "GET_MEDIA_STATE") {
        const vid = document.querySelector("video") || document.querySelector("audio");
        if (vid) {
          sendResponse({
            hasMedia: true,
            paused: vid.paused,
            title: document.title.replace(/ - YouTube$/, "").trim() || location.hostname,
            currentTime: vid.currentTime,
            duration: vid.duration || 0,
            volume: vid.volume,
            muted: vid.muted
          });
        } else {
          sendResponse({ hasMedia: false });
        }
        return true;
      }

      // ---- Execute media control command (from cross-tab) ----
      if (msg.type === "MEDIA_CONTROL") {
        const vid = document.querySelector("video") || document.querySelector("audio");
        if (vid) {
          if (msg.action === "play_pause") { vid.paused ? vid.play() : vid.pause(); }
          else if (msg.action === "seek_back") { vid.currentTime = Math.max(0, vid.currentTime - 10); }
          else if (msg.action === "seek_fwd") { vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10); }
          else if (msg.action === "volume") { vid.volume = msg.value / 100; vid.muted = false; }
          else if (msg.action === "mute") { vid.muted = !vid.muted; }
          else if (msg.action === "next") { const nb = document.querySelector(".ytp-next-button"); if (nb) nb.click(); }
          sendResponse({ ok: true, paused: vid.paused });
        } else {
          sendResponse({ ok: false });
        }
        return true;
      }
    });
  } catch (e) { }

  // ---- YouTube Music Control Widget ----
  const ytWidget = document.createElement("div");
  ytWidget.className = "bp-yt-widget";

  // Header
  const ytHeader = document.createElement("div");
  ytHeader.className = "bp-yt-header";
  const ytIcon = document.createElement("span");
  ytIcon.className = "bp-yt-icon";
  ytIcon.textContent = "🎵";
  const ytTitleEl = document.createElement("div");
  ytTitleEl.className = "bp-yt-title";
  ytTitleEl.textContent = "YouTube";
  const ytClose = document.createElement("button");
  ytClose.className = "bp-yt-close";
  ytClose.textContent = "✕";
  ytHeader.appendChild(ytIcon);
  ytHeader.appendChild(ytTitleEl);
  ytHeader.appendChild(ytClose);

  // Progress bar
  const ytProgressWrap = document.createElement("div");
  ytProgressWrap.className = "bp-yt-progress-wrap";
  const ytProgressBar = document.createElement("div");
  ytProgressBar.className = "bp-yt-progress-bar";
  ytProgressWrap.appendChild(ytProgressBar);

  // Time display
  const ytTime = document.createElement("div");
  ytTime.className = "bp-yt-time";
  ytTime.textContent = "0:00 / 0:00";

  // Control buttons
  const ytBtns = document.createElement("div");
  ytBtns.className = "bp-yt-btns";
  const ytBtnBack = document.createElement("button");
  ytBtnBack.className = "bp-yt-btn";
  ytBtnBack.title = "ย้อนกลับ 10 วินาที";
  ytBtnBack.textContent = "⏮";
  const ytBtnPlay = document.createElement("button");
  ytBtnPlay.className = "bp-yt-btn bp-yt-btn-main";
  ytBtnPlay.textContent = "▶";
  const ytBtnFwd = document.createElement("button");
  ytBtnFwd.className = "bp-yt-btn";
  ytBtnFwd.title = "ข้ามไป 10 วินาที";
  ytBtnFwd.textContent = "⏭";
  const ytBtnNext = document.createElement("button");
  ytBtnNext.className = "bp-yt-btn";
  ytBtnNext.title = "วิดีโอถัดไป";
  ytBtnNext.textContent = "⏩";
  ytBtns.appendChild(ytBtnBack);
  ytBtns.appendChild(ytBtnPlay);
  ytBtns.appendChild(ytBtnFwd);
  ytBtns.appendChild(ytBtnNext);

  // Volume
  const ytVolWrap = document.createElement("div");
  ytVolWrap.className = "bp-yt-vol-wrap";
  const ytVolIcon = document.createElement("span");
  ytVolIcon.className = "bp-yt-vol-icon";
  ytVolIcon.textContent = "🔊";
  const ytVolSlider = document.createElement("input");
  ytVolSlider.type = "range";
  ytVolSlider.min = "0";
  ytVolSlider.max = "100";
  ytVolSlider.value = "100";
  ytVolSlider.className = "bp-yt-vol-slider";
  ytVolWrap.appendChild(ytVolIcon);
  ytVolWrap.appendChild(ytVolSlider);

  ytWidget.appendChild(ytHeader);
  ytWidget.appendChild(ytProgressWrap);
  ytWidget.appendChild(ytTime);
  ytWidget.appendChild(ytBtns);
  ytWidget.appendChild(ytVolWrap);
  root.appendChild(ytWidget);

  let ytUserClosed = false;
  let ytManualOpen = false;

  const getMedia = () => document.querySelector("video") || document.querySelector("audio");
  const hasMedia = () => !!getMedia();

  function fmtTime(s) {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function getMediaTitle() {
    // Try YouTube-specific selectors first
    const sels = [
      "h1.ytd-watch-metadata yt-formatted-string",
      "#above-the-fold #title yt-formatted-string",
      ".ytp-title-link",
      "#title h1"
    ];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    // Fallback: page title
    return document.title.replace(/ - YouTube$/, "").replace(/ - .+$/, "").trim() || location.hostname;
  }

  function updateYTWidget() {
    if (!ytManualOpen || ytUserClosed) return;

    const vid = getMedia();
    ytWidget.classList.add("show");

    if (!vid) {
      ytTitleEl.textContent = "ไม่พบสื่อในหน้านี้";
      ytBtnPlay.textContent = "▶";
      ytTime.textContent = "-- / --";
      return;
    }

    // Title
    const title = getMediaTitle();
    ytTitleEl.textContent = title.length > 36 ? title.slice(0, 34) + "…" : title;

    // Play/pause icon
    ytBtnPlay.textContent = vid.paused ? "▶" : "⏸";

    // Progress
    if (vid.duration) {
      ytProgressBar.style.width = ((vid.currentTime / vid.duration) * 100) + "%";
      ytTime.textContent = `${fmtTime(vid.currentTime)} / ${fmtTime(vid.duration)}`;
    }

    // Volume
    ytVolSlider.value = vid.muted ? 0 : Math.round(vid.volume * 100);
    ytVolIcon.textContent = (vid.muted || vid.volume === 0) ? "🔇" : vid.volume < 0.5 ? "🔉" : "🔊";
  }

  // ---- Widget event listeners ----
  ytClose.addEventListener("click", (e) => {
    e.stopPropagation();
    ytUserClosed = true;
    ytManualOpen = false;
    ytWidget.classList.remove("show");
  });

  ytBtnPlay.addEventListener("click", (e) => {
    e.stopPropagation();
    const vid = getMedia();
    if (!vid) return;
    vid.paused ? vid.play() : vid.pause();
    setTimeout(updateYTWidget, 80);
  });

  ytBtnBack.addEventListener("click", (e) => {
    e.stopPropagation();
    const vid = getMedia();
    if (vid) vid.currentTime = Math.max(0, vid.currentTime - 10);
  });

  ytBtnFwd.addEventListener("click", (e) => {
    e.stopPropagation();
    const vid = getMedia();
    if (vid) vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10);
  });

  ytBtnNext.addEventListener("click", (e) => {
    e.stopPropagation();
    const nextBtn = document.querySelector(".ytp-next-button");
    if (nextBtn) nextBtn.click();
  });

  ytVolSlider.addEventListener("input", (e) => {
    e.stopPropagation();
    const vid = getMedia();
    if (!vid) return;
    vid.volume = parseInt(e.target.value) / 100;
    vid.muted = false;
    updateYTWidget();
  });
  ytVolSlider.addEventListener("click", (e) => e.stopPropagation());

  ytVolIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    const vid = getMedia();
    if (!vid) return;
    vid.muted = !vid.muted;
    updateYTWidget();
  });

  ytProgressWrap.addEventListener("click", (e) => {
    e.stopPropagation();
    const vid = getMedia();
    if (!vid || !vid.duration) return;
    const rect = ytProgressWrap.getBoundingClientRect();
    vid.currentTime = ((e.clientX - rect.left) / rect.width) * vid.duration;
  });

  // Periodic update (local media)
  setInterval(() => {
    if (!ytRemoteTabId) updateYTWidget();
  }, 1000);

  // Remote polling interval — refresh cross-tab state every second
  setInterval(() => {
    if (!ytRemoteTabId || ytUserClosed) return;
    try {
      chrome.runtime.sendMessage({ type: "GET_REMOTE_MEDIA_STATE", tabId: ytRemoteTabId }, (res) => {
        if (chrome.runtime.lastError || !res) {
          // Tab gone — fallback to local
          ytRemoteTabId = null;
          updateYTWidget();
          return;
        }
        applyRemoteState(res);
      });
    } catch (e) { ytRemoteTabId = null; }
  }, 1000);

  // Watch for page title changes (SPA navigation or media changes)
  const ytTitleNode = document.querySelector("title");
  if (ytTitleNode) {
    new MutationObserver(() => {
      if (!ytRemoteTabId) { setTimeout(updateYTWidget, 800); }
    }).observe(ytTitleNode, { childList: true });
  }

  // Helpers for remote state rendering
  function applyRemoteState(state) {
    if (!state) return;
    const title = state.title || "Unknown";
    ytTitleEl.textContent = (title.length > 30 ? title.slice(0, 28) + "\u2026" : title) + " \ud83d\udd04";
    ytBtnPlay.textContent = state.paused ? "\u25b6" : "\u23f8";
    if (state.duration) {
      ytProgressBar.style.width = ((state.currentTime / state.duration) * 100) + "%";
      ytTime.textContent = `${fmtTime(state.currentTime)} / ${fmtTime(state.duration)}`;
    }
    ytVolSlider.value = state.muted ? 0 : Math.round(state.volume * 100);
    ytVolIcon.textContent = (state.muted || state.volume === 0) ? "\ud83d\udd07" : state.volume < 0.5 ? "\ud83d\udd09" : "\ud83d\udd0a";
  }

  function relayControl(action, value) {
    if (!ytRemoteTabId) return;
    try {
      chrome.runtime.sendMessage({ type: "RELAY_MEDIA_CONTROL", tabId: ytRemoteTabId, action, value });
    } catch (e) { }
  }

  // 🎵 Music button — smart: local first, then cross-tab search
  musicBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeInput();

    // Toggle off
    if (ytWidget.classList.contains("show")) {
      ytUserClosed = true;
      ytManualOpen = false;
      ytRemoteTabId = null;
      ytWidget.classList.remove("show");
      return;
    }

    ytUserClosed = false;
    ytManualOpen = true;

    // Case 1: local media present
    if (hasMedia()) {
      ytRemoteTabId = null;
      updateYTWidget();
      return;
    }

    // Case 2: search across all tabs
    ytWidget.classList.add("show");
    ytTitleEl.textContent = "\ud83d\udd0d \u0e04้นหาเพลงในแท็บอื่น...";
    ytBtnPlay.textContent = "\u23f3";
    try {
      chrome.runtime.sendMessage({ type: "FIND_MEDIA_TAB" }, (res) => {
        if (chrome.runtime.lastError || !res) {
          ytTitleEl.textContent = "\u0e44ม่พบเพลงในแท็บใด";
          ytBtnPlay.textContent = "\u25b6";
          ytTime.textContent = "-- / --";
          return;
        }
        ytRemoteTabId = res.tabId;
        applyRemoteState(res.state);
      });
    } catch (e) { ytTitleEl.textContent = "\u0e40กิดข้อผิดพลาด"; }
  });

  // Override controls to route through background when in remote mode
  const origPlayClick = ytBtnPlay.onclick;
  ytBtnPlay.addEventListener("click", (e) => {
    if (!ytRemoteTabId) return; // local handled separately
    e.stopPropagation();
    relayControl("play_pause");
  }, true);
  ytBtnBack.addEventListener("click", (e) => {
    if (!ytRemoteTabId) return;
    e.stopPropagation();
    relayControl("seek_back");
  }, true);
  ytBtnFwd.addEventListener("click", (e) => {
    if (!ytRemoteTabId) return;
    e.stopPropagation();
    relayControl("seek_fwd");
  }, true);
  ytBtnNext.addEventListener("click", (e) => {
    if (!ytRemoteTabId) return;
    e.stopPropagation();
    relayControl("next");
  }, true);
  ytVolSlider.addEventListener("input", (e) => {
    if (!ytRemoteTabId) return;
    e.stopPropagation();
    relayControl("volume", parseInt(e.target.value));
  }, true);
  ytVolIcon.addEventListener("click", (e) => {
    if (!ytRemoteTabId) return;
    e.stopPropagation();
    relayControl("mute");
  }, true);
  ytProgressWrap.addEventListener("click", (e) => {
    if (!ytRemoteTabId) return;
    const vid_duration = parseFloat(ytTime.textContent.split(" / ")[1]?.replace(/:/g, "")) || 0;
    const rect = ytProgressWrap.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    // Approximate seek
    chrome.runtime.sendMessage({ type: "GET_REMOTE_MEDIA_STATE", tabId: ytRemoteTabId }, (res) => {
      if (res && res.duration) relayControl("seek_fwd"); // simplified
    });
  }, true);

  updateYTWidget();

  // ---- Start ----
  positionPet();
  setAnim("walk-r");
  requestAnimationFrame(loop);
  setTimeout(() => say([`สวัสดี! ฉัน${getPet().name} นะ~ 👋`]), 1200);

})();
