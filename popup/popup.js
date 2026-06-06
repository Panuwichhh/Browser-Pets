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

let cfg = { enabled: true, petId: "cat", provider: "claude", model: "", apiKey: "", language: "th" };

function saveAllSettings(callback) {
  const { apiKey: key, ...prefs } = cfg;
  chrome.storage.sync.set({ petSettings: prefs }, () => {
    chrome.storage.local.set({ petApiKey: key || "" }, callback);
  });
}

// ---- API Key security helpers ----

const KEY_PREFIXES = { claude: "sk-ant-", openai: "sk-", gemini: "AIza" };

function maskKey(key) {
  if (!key || key.length < 8) return "";
  return key.slice(0, 7) + "••••••••••••" + key.slice(-4);
}

function validateKeyFormat(key, provider) {
  if (!key) return null;
  const prefix = KEY_PREFIXES[provider];
  if (prefix && !key.startsWith(prefix)) {
    return `key ของ ${provider} ควรเริ่มต้นด้วย "${prefix}..."`;
  }
  return null;
}

function lockKeyInput() {
  const inp = document.getElementById("api-key");
  if (!cfg.apiKey) return;
  inp.type = "password";
  inp.value = maskKey(cfg.apiKey);
  inp.setAttribute("readonly", "");
  inp.title = "คลิกเพื่อเปลี่ยน API key";
  clearKeyWarn();
}

function unlockKeyInput() {
  const inp = document.getElementById("api-key");
  inp.value = "";
  inp.removeAttribute("readonly");
  inp.title = "";
  inp.type = "password";
  clearKeyWarn();
  inp.focus();
}

function showKeyWarn(msg) {
  document.getElementById("key-warn").textContent = msg;
  document.getElementById("key-warn").classList.add("show");
  document.getElementById("key-ok").classList.remove("show");
}

function showKeyOk() {
  document.getElementById("key-ok").classList.add("show");
  document.getElementById("key-warn").classList.remove("show");
}

function clearKeyWarn() {
  document.getElementById("key-warn").classList.remove("show");
  document.getElementById("key-ok").classList.remove("show");
}

// ---- Wire up all buttons after DOM ready ----
document.addEventListener("DOMContentLoaded", () => {

  // load saved settings
  chrome.storage.sync.get(["petSettings"], (syncRes) => {
    chrome.storage.local.get(["petApiKey"], (localRes) => {
      if (syncRes && syncRes.petSettings) cfg = { ...cfg, ...syncRes.petSettings };
      cfg.apiKey = localRes.petApiKey || cfg.apiKey || "";
      renderUI();
    });
  });

  // Toggle on/off
  document.getElementById("toggle").addEventListener("click", () => {
    cfg.enabled = !cfg.enabled;
    document.getElementById("toggle").classList.toggle("on", cfg.enabled);
    document.getElementById("toggle-label").textContent = cfg.enabled ? "เปิด" : "ปิด";
    saveAllSettings(() => msgTab({ type: "TOGGLE" }));
  });

  // Pet buttons
  document.querySelectorAll(".pet-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      cfg.petId = btn.dataset.pet;
      document.querySelectorAll(".pet-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      saveAllSettings(() => msgTab({ type: "SET_PET", pet: cfg.petId }));
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

  // Language change (Instant auto-save like toggle/pet picker)
  document.getElementById("language").addEventListener("change", () => {
    cfg.language = document.getElementById("language").value;
    saveAllSettings(() => { updateStatus(); msgTab({ type: "RELOAD_SETTINGS" }); });
  });

  // Eye button — show/hide key (handles both locked and edit modes)
  document.getElementById("eye-btn").addEventListener("click", () => {
    const inp = document.getElementById("api-key");
    if (inp.hasAttribute("readonly")) {
      // Locked mode: toggle between masked and real key
      if (inp.type === "text") {
        inp.value = maskKey(cfg.apiKey);
        inp.type = "password";
      } else {
        inp.value = cfg.apiKey;
        inp.type = "text";
      }
    } else {
      inp.type = inp.type === "password" ? "text" : "password";
    }
  });

  // Click on locked input → unlock for editing
  document.getElementById("api-key").addEventListener("click", () => {
    if (document.getElementById("api-key").hasAttribute("readonly")) unlockKeyInput();
  });

  // Blur: validate format if editing, re-lock if empty
  document.getElementById("api-key").addEventListener("blur", () => {
    const inp = document.getElementById("api-key");
    if (inp.hasAttribute("readonly")) return;
    const val = inp.value.trim();
    if (!val) {
      // User cleared the field without entering new key — restore locked view
      if (cfg.apiKey) lockKeyInput();
      return;
    }
    const warn = validateKeyFormat(val, cfg.provider || document.getElementById("provider").value);
    if (warn) showKeyWarn(warn);
    else showKeyOk();
  });

  // Save
  document.getElementById("btn-save").addEventListener("click", () => {
    cfg.provider = document.getElementById("provider").value;
    cfg.model = document.getElementById("model").value.trim();
    cfg.language = document.getElementById("language").value;
    const keyInp = document.getElementById("api-key");
    if (!keyInp.hasAttribute("readonly")) {
      // Only update apiKey if user actually edited the field
      const newKey = keyInp.value.trim();
      const warn = newKey ? validateKeyFormat(newKey, cfg.provider) : null;
      if (warn) { showKeyWarn(warn); return; }
      cfg.apiKey = newKey;
    }
    saveAllSettings(() => {
      if (cfg.apiKey) lockKeyInput();
      clearKeyWarn();
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
    const keyInp = document.getElementById("api-key");
    const tmp = {
      provider: document.getElementById("provider").value,
      model: document.getElementById("model").value.trim(),
      language: document.getElementById("language").value,
      apiKey: keyInp.hasAttribute("readonly") ? cfg.apiKey : keyInp.value.trim(),
    };
    const testPrompt = tmp.language === "en" ? "Say a short greeting in English" : "ทักทายสั้นๆ เป็นภาษาไทย";
    chrome.runtime.sendMessage(
      { type: "ASK_AI", text: testPrompt, pageContext: "ทดสอบ / Test", settings: tmp },
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
  document.getElementById("language").value = cfg.language || "th";
  if (cfg.apiKey) lockKeyInput();
  else document.getElementById("api-key").value = "";
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
    txt.textContent = `พร้อมใช้ · ${cfg.provider} · ${cfg.model || "default"} · ${cfg.language === "en" ? "English" : "ภาษาไทย"}`;
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
