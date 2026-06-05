# 🐾 Browser Pets — AI ข้างจอ

สัตว์เลี้ยงการ์ตูนที่เดินเล่นอยู่ใน browser และคุยกับ AI ได้!

---

## วิธีติดตั้ง (Chrome / Edge)

1. เปิด Chrome แล้วไปที่ `chrome://extensions`
2. เปิด **Developer mode** (toggle มุมขวาบน)
3. กด **Load unpacked**
4. เลือกโฟลเดอร์ `browser-pets-extension` นี้
5. extension จะปรากฏใน toolbar ทันที 🎉

---

## วิธีใช้

### 1. ตั้งค่า API Key
- กดไอคอน 🐾 ใน toolbar
- เลือก **Provider** (Claude / ChatGPT / Gemini)
- วาง **API Key** ของคุณ
- กด **บันทึก**
- กด **ทดสอบ** เพื่อเช็กว่าใช้งานได้

### 2. คุยกับสัตว์เลี้ยง
- สัตว์เลี้ยงจะเดินเล่นอยู่ด้านล่างของทุกหน้า
- **คลิกที่ตัวสัตว์** เพื่อพิมพ์คำถาม
- กด Enter หรือปุ่ม **ส่ง**
- รอ AI ตอบใน speech bubble

### 3. เปลี่ยนตัวสัตว์เลี้ยง
- กดไอคอน 🐾 → เลือกตัวที่ชอบ
- มี 5 ตัว: 🐱 🐶 🐸 🦊 🐧

### 4. ปิด/เปิด
- Toggle ใน popup เพื่อซ่อนชั่วคราว

---

## API Keys ที่รองรับ

| Provider | Model default | ลิงก์รับ Key |
|----------|--------------|-------------|
| Claude (Anthropic) | claude-haiku-4-5 | https://console.anthropic.com |
| ChatGPT (OpenAI) | gpt-4o-mini | https://platform.openai.com/api-keys |
| Gemini (Google) | gemini-1.5-flash | https://aistudio.google.com/app/apikey |

> API Key เก็บใน `chrome.storage.sync` (local บนเครื่องคุณ ไม่ส่งไปไหน)

---

## โครงสร้างไฟล์

```
browser-pets-extension/
├── manifest.json       ← config หลัก
├── background.js       ← service worker + เรียก AI API
├── content/
│   ├── pet.js          ← ตัวการ์ตูนที่ inject ในทุกหน้า
│   └── pet.css         ← style ของสัตว์เลี้ยง
├── popup/
│   ├── popup.html      ← หน้า UI ตั้งค่า
│   └── popup.js        ← logic ของ popup
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Next Steps (ถ้าอยากพัฒนาต่อ)

- [ ] เพิ่มสัตว์เลี้ยงพรีเมียมด้วยรูปแบบ sprite sheet
- [ ] ให้สัตว์เลี้ยง aware หน้าเว็บ (อ่าน content แล้วคอมเมนต์เอง)
- [ ] เพิ่ม sound effects
- [ ] Meeting mode (detect Google Meet แล้วสลับโหมด)
- [ ] Publish ขึ้น Chrome Web Store
