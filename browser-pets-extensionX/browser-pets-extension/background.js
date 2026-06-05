// background.js — service worker

// รับ message จาก content script และ popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ASK_AI") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0] ? tabs[0].id : null;
      handleAI(msg.text, msg.pageContext, msg.settings, tabId).then(sendResponse);
    });
    return true; // async response
  }
  
  // Request page content and forward to AI for actions like summarize/analyze
  if (msg.type === "PAGE_AI") {
    const { action, options, settings } = msg;

    if (action === "group_tabs") {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        const tabId = tab ? tab.id : null;
        try {
          const res = await handleAI("กรุณาวิเคราะห์และจัดกลุ่มแท็บที่เปิดอยู่ทั้งหมดตามความเหมาะสม", "จัดกลุ่มแท็บ", settings || {}, tabId);
          sendResponse(res);
        } catch (err) {
          sendResponse({ reply: `เกิดข้อผิดพลาด: ${err.message}` });
        }
      });
      return true; // async response
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) { sendResponse({ reply: "ไม่พบแท็บที่ active" }); return; }
      chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTENT", options }, async (pageRes) => {
        if (chrome.runtime.lastError) { sendResponse({ reply: "ไม่สามารถเข้าถึงเนื้อหาหน้านี้" }); return; }
        const pageText = (pageRes && pageRes.text) ? pageRes.text : "";
        const pageContext = `${pageRes.title || tab.title || ''} · ${pageRes.url || tab.url || ''}`;
        let prompt = "";
        if (action === "summarize") {
          prompt = `สรุปหน้าเว็บต่อไปนี้ โดยย่อเป็นประเด็นสำคัญและหัวข้อสั้นๆ ไม่เกิน 2 บรรทัด:\n\n${pageText}`;
        } else if (action === "analyze") {
          prompt = `วิเคราะห์หน้าเว็บนี้: ระบุข้อดี ข้อเสีย และข้อสังเกต พร้อมสรุปเป็นหัวข้อ ไม่เกิน 2 บรรทัด:\n\n${pageText}`;
        } else {
          prompt = `${action}\n\n${pageText}`;
        }
        try {
          const res = await handleAI(prompt, pageContext, settings || {}, tab.id);
          sendResponse(res);
        } catch (err) { sendResponse({ reply: `เกิดข้อผิดพลาด: ${err.message}` }); }
      });
    });
    return true; // async response
  }
  if (msg.type === "OPEN_POPUP") {
    chrome.action.openPopup();
  }
  if (msg.type === "TOGGLE_PET") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE" });
      }
    });
  }
  if (msg.type === "CHANGE_PET") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "SET_PET", pet: msg.pet });
      }
    });
  }

  // ---- Cross-tab Media Control ----

  // Scan all tabs to find one with playing media
  if (msg.type === "FIND_MEDIA_TAB") {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const results = [];
      let pending = tabs.length;
      if (pending === 0) { sendResponse(null); return; }

      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: "GET_MEDIA_STATE" }, (res) => {
          if (chrome.runtime.lastError) { /* ignore non-content-script tabs */ }
          else if (res && res.hasMedia) {
            results.push({ tabId: tab.id, title: tab.title, favIconUrl: tab.favIconUrl || "", state: res });
          }
          if (--pending === 0) {
            // Prefer actively playing tab, then fallback to first with media
            const playing = results.find(r => !r.state.paused);
            sendResponse(playing || results[0] || null);
          }
        });
      });
    });
    return true; // async response
  }

  // Get media state from a specific tab by ID
  if (msg.type === "GET_REMOTE_MEDIA_STATE") {
    chrome.tabs.sendMessage(msg.tabId, { type: "GET_MEDIA_STATE" }, (res) => {
      if (chrome.runtime.lastError) { sendResponse(null); return; }
      sendResponse(res || null);
    });
    return true; // async response
  }

  // Relay a media control command to a specific tab
  if (msg.type === "RELAY_MEDIA_CONTROL") {
    chrome.tabs.sendMessage(msg.tabId, { type: "MEDIA_CONTROL", action: msg.action, value: msg.value }, (res) => {
      if (chrome.runtime.lastError) { sendResponse({ ok: false }); return; }
      sendResponse(res || { ok: true });
    });
    return true; // async response
  }
});

async function getAllWindowTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      resolve(tabs.map(t => ({ id: t.id, title: t.title || "Untitled", url: t.url || "" })));
    });
  });
}

function parseAIResponse(text) {
  console.log("Raw AI response:", text);
  try {
    let jsonStr = text.trim();
    
    // Find the first { and last } to extract JSON block from conversational text
    const startIdx = jsonStr.indexOf("{");
    const endIdx = jsonStr.lastIndexOf("}");
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    }
    
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.reply === "string") {
      console.log("Successfully parsed JSON response:", parsed);
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse JSON response, falling back to text:", e, text);
  }
  return { reply: text, action: null };
}

async function executeTabAction(parsed) {
  if (!parsed || !parsed.action) return;
  
  console.log("Executing tab action:", parsed.action, parsed);
  try {
    if (parsed.action === "open_tab" && parsed.url) {
      let url = parsed.url;
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
      }
      await chrome.tabs.create({ url });
    }
    else if (parsed.action === "close_tabs" && Array.isArray(parsed.tabIds)) {
      const ids = parsed.tabIds.map(Number).filter(id => !isNaN(id));
      if (ids.length > 0) {
        await chrome.tabs.remove(ids);
      }
    }
    else if (parsed.action === "group_tabs" && Array.isArray(parsed.groups)) {
      for (const group of parsed.groups) {
        const ids = (group.tabIds || []).map(Number).filter(id => !isNaN(id));
        if (ids.length > 0) {
          const groupId = await chrome.tabs.group({ tabIds: ids });
          const updateProps = {};
          if (group.title) updateProps.title = group.title;
          if (group.color) updateProps.color = group.color;
          await chrome.tabGroups.update(groupId, updateProps);
        }
      }
    }
  } catch (err) {
    console.error("Error executing tab action:", err);
  }
}

async function handleAI(userText, pageContext, settings, activeTabId = null) {
  const { apiKey, model, provider } = settings;

  if (!apiKey) {
    return { reply: "ยังไม่ได้ใส่ API key นะ! กดไอคอน extension แล้วไปที่ Settings ได้เลย" };
  }

  const tabsList = await getAllWindowTabs();
  const tabsContext = tabsList.map(t => `ID: ${t.id} - Title: "${t.title}" - URL: ${t.url}${t.id === activeTabId ? " (Active Tab)" : ""}`).join("\n");

  const systemPrompt = `คุณคือสัตว์เลี้ยง AI น่ารักที่อาศัยอยู่ใน browser ของผู้ใช้
ตอบสั้นๆ กระชับ น่ารักและเป็นมิตร
บริบทหน้าเว็บปัจจุบัน: ${pageContext || "ไม่มีข้อมูล"}

คุณมีความสามารถในการควบคุม Tabs ของเบราว์เซอร์
นี่คือรายการแท็บทั้งหมดที่เปิดอยู่ในหน้าต่างปัจจุบัน:
${tabsContext}

กฎสำคัญ: ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON

รูปแบบสำหรับการพูดคุยทั่วไป:
{"reply":"ข้อความตอบกลับภาษาไทย"}

รูปแบบสำหรับเปิดแท็บใหม่:
{"reply":"ข้อความแจ้งผู้ใช้","action":"open_tab","url":"https://example.com"}

รูปแบบสำหรับปิดแท็บ:
{"reply":"ข้อความแจ้งผู้ใช้","action":"close_tabs","tabIds":[123,456]}

รูปแบบสำหรับจัดกลุ่มแท็บ (ใช้ ID จากรายการแท็บด้านบน):
{"reply":"ข้อความแจ้งผู้ใช้","action":"group_tabs","groups":[{"title":"ชื่อกลุ่ม","color":"blue","tabIds":[123,456]},{"title":"ชื่อกลุ่ม2","color":"red","tabIds":[789]}]}

ค่าสี color ที่ใช้ได้: blue, red, yellow, green, pink, purple, cyan, orange, grey`;

  try {
    // ---- Claude (Anthropic) ----
    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: model || "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: userText }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "API error");
      const parsed = parseAIResponse(data.content[0].text);
      await executeTabAction(parsed);
      return { reply: parsed.reply };
    }

    // ---- OpenAI (GPT) ----
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          max_tokens: 1000,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            { role: "user", content: userText }
          ]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "API error");
      const parsed = parseAIResponse(data.choices[0].message.content);
      await executeTabAction(parsed);
      return { reply: parsed.reply };
    }

    // ---- Google Gemini ----
    if (provider === "gemini") {
      const modelName = model || "gemini-1.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${systemPrompt}

คำถาม/คำสั่งของผู้ใช้: ${userText}`
              }]
            }],
            generationConfig: { maxOutputTokens: 1000 }
          })
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "API error");
      const parsed = parseAIResponse(data.candidates[0].content.parts[0].text);
      await executeTabAction(parsed);
      return { reply: parsed.reply };
    }

    return { reply: "ยังไม่รองรับ provider นี้" };

  } catch (err) {
    console.error("AI error:", err);
    return { reply: `เกิดข้อผิดพลาด: ${err.message}` };
  }
}
