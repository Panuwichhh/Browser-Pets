// popup.js — MV3 safe, no inline handlers

const PRESETS = {
  claude: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"],
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
};
const HINTS = {
  claude: 'รับ key ที่ <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>',
  openai: 'รับ key ที่ <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>',
  gemini: 'รับ key ที่ <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com</a>',
};

let cfg = { enabled: true, petId: "cat", provider: "claude", model: "", apiKey: "" };

// ---- Wire up all buttons after DOM ready ----
document.addEventListener("DOMContentLoaded", () => {

  // load saved settings
  chrome.storage.sync.get(["petSettings"], (res) => {
    if (res && res.petSettings) cfg = { ...cfg, ...res.petSettings };
    renderUI();
  });

  // Toggle on/off
  document.getElementById("toggle").addEventListener("click", () => {
    cfg.enabled = !cfg.enabled;
    document.getElementById("toggle").classList.toggle("on", cfg.enabled);
    document.getElementById("toggle-label").textContent = cfg.enabled ? "เปิด" : "ปิด";
    chrome.storage.sync.set({ petSettings: cfg });
    msgTab({ type: "TOGGLE" });
  });

  // Pet buttons
  document.querySelectorAll(".pet-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      cfg.petId = btn.dataset.pet;
      document.querySelectorAll(".pet-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      chrome.storage.sync.set({ petSettings: cfg });
      msgTab({ type: "SET_PET", pet: cfg.petId });
    });
  });

  // Provider change
  document.getElementById("provider").addEventListener("change", () => {
    cfg.provider = document.getElementById("provider").value;
    cfg.model = "";
    document.getElementById("model").value = "";
    renderPresets(cfg.provider);
    document.getElementById("api-hint").innerHTML = HINTS[cfg.provider] || "";
  });

  // Eye button — show/hide key
  document.getElementById("eye-btn").addEventListener("click", () => {
    const inp = document.getElementById("api-key");
    inp.type = inp.type === "password" ? "text" : "password";
  });

  // Save
  document.getElementById("btn-save").addEventListener("click", () => {
    cfg.provider = document.getElementById("provider").value;
    cfg.model = document.getElementById("model").value.trim();
    cfg.apiKey = document.getElementById("api-key").value.trim();
    chrome.storage.sync.set({ petSettings: cfg }, () => {
      const st = document.getElementById("save-status");
      st.classList.add("show");
      setTimeout(() => st.classList.remove("show"), 2000);
      updateStatus();
      msgTab({ type: "RELOAD_SETTINGS" });
    });
  });

  // Test
  document.getElementById("btn-test").addEventListener("click", () => {
    const btn = document.getElementById("btn-test");
    btn.textContent = "กำลังทดสอบ...";
    btn.disabled = true;
    const tmp = {
      provider: document.getElementById("provider").value,
      model: document.getElementById("model").value.trim(),
      apiKey: document.getElementById("api-key").value.trim(),
    };
    chrome.runtime.sendMessage(
      { type: "ASK_AI", text: "ทักทายสั้นๆ เป็นภาษาไทย", pageContext: "ทดสอบ", settings: tmp },
      (res) => {
        btn.textContent = "ทดสอบ";
        btn.disabled = false;
        if (res && res.reply) {
          alert("✅ AI ตอบว่า:\n\n" + res.reply);
        } else {
          alert("❌ ไม่ได้รับคำตอบ\nลองตรวจสอบ API key และ provider ดูนะ");
        }
      }
    );
  });

});

// ---- Helpers ----
function renderUI() {
  // toggle
  const on = cfg.enabled !== false;
  document.getElementById("toggle").classList.toggle("on", on);
  document.getElementById("toggle-label").textContent = on ? "เปิด" : "ปิด";

  // pet buttons
  document.querySelectorAll(".pet-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.pet === cfg.petId));

  // form
  document.getElementById("provider").value = cfg.provider || "claude";
  document.getElementById("model").value = cfg.model || "";
  document.getElementById("api-key").value = cfg.apiKey || "";
  renderPresets(cfg.provider || "claude");
  document.getElementById("api-hint").innerHTML = HINTS[cfg.provider] || HINTS.claude;
  updateStatus();
}

function renderPresets(provider) {
  const wrap = document.getElementById("model-presets");
  wrap.innerHTML = "";
  (PRESETS[provider] || []).forEach(m => {
    const b = document.createElement("button");
    b.className = "preset-btn";
    b.textContent = m;
    b.addEventListener("click", () => { document.getElementById("model").value = m; });
    wrap.appendChild(b);
  });
}

function updateStatus() {
  const dot = document.getElementById("status-dot");
  const txt = document.getElementById("status-text");
  if (cfg.apiKey && cfg.apiKey.trim().length > 8) {
    dot.classList.add("ok");
    txt.textContent = `พร้อมใช้ · ${cfg.provider} · ${cfg.model || "default model"}`;
  } else {
    dot.classList.remove("ok");
    txt.textContent = "ยังไม่มี API key — สัตว์เดินได้แล้ว แต่คุยยังไม่ได้";
  }
}

function msgTab(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, msg, () => {
      if (chrome.runtime.lastError) { /* tab ยังไม่มี content script — ไม่เป็นไร */ }
    });
  });
}
