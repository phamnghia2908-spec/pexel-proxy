import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Giữ nguyên logic lấy key của bạn
const API_KEYS = [
  process.env.PEXELS_API_KEY_1,
  process.env.PEXELS_API_KEY_2,
  process.env.PEXELS_API_KEY_3
].filter(Boolean);

let preferredKeyIndex = 0; 

app.use(cors({ origin: "*" })); // Giữ nguyên CORS

// NÂNG CẤP 1: Thêm signal để tránh treo request lâu
async function fetchImageWithKey(keyword, key) {
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=5`,
      { 
        headers: { Authorization: key },
        signal: AbortSignal.timeout(5000) // Nếu Pexels quá 5s không hồi đáp thì bỏ qua
      }
    );
    if (!resp.ok) {
      console.warn(`Key failed: ${key.substring(0, 8)}... → status ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const photo = data.photos?.find(p => p?.src?.medium);
    return photo?.src?.medium || null;
  } catch (err) {
    console.warn(`Fetch error with key:`, err.message);
    return null;
  }
}

// Giữ nguyên logic xoay vòng thông minh của bạn
async function fetchImageSmart(keyword) {
  for (let i = 0; i < API_KEYS.length; i++) {
    const index = (preferredKeyIndex + i) % API_KEYS.length;
    const key = API_KEYS[index];
    const url = await fetchImageWithKey(keyword, key);
    if (url) {
      preferredKeyIndex = index; 
      return url;
    }
  }
  return null;
}

// NÂNG CẤP 2: Chuyển batch sang tuần tự để an toàn cho Key (tránh bị Pexels ban)
app.get("/api/pexels/batch", async (req, res) => {
  const raw = (req.query.keywords || "").trim();
  if (!raw) return res.status(400).json({ error: "Missing keywords" });

  const list = [...new Set(raw.split(",").map(k => k.trim().toLowerCase()).filter(Boolean))];
  const results = {};

  try {
    // Thay Promise.all bằng vòng lặp for để gọi lần lượt
    for (const k of list) {
      results[k] = await fetchImageSmart(k);
      // Nghỉ nhẹ 50ms để không bị coi là tấn công DDoS
      await new Promise(r => setTimeout(r, 50));
    }
    res.json({ images: results });
  } catch (err) {
    res.status(500).json({ error: "Batch proxy error", details: err.message });
  }
});

// NÂNG CẤP 3: Thêm "0.0.0.0" để Render nhận diện được server (Sửa lỗi Exited Early)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Proxy chạy tốt tại cổng ${PORT}`);
  console.log(`🔑 Đang dùng ${API_KEYS.length} keys`);
});
