import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Lấy key và kiểm tra
const API_KEYS = [
  process.env.PEXELS_API_KEY_1,
  process.env.PEXELS_API_KEY_2,
  process.env.PEXELS_API_KEY_3
].filter(Boolean);

// Cảnh báo nếu chưa nhập biến môi trường trên Dashboard Render
if (API_KEYS.length === 0) {
  console.error("❌ ERROR: No PEXELS_API_KEYS found in Environment Variables!");
}

let preferredKeyIndex = 0;

app.use(cors({ origin: "*" }));

// Hàm gọi ảnh đơn lẻ
async function fetchImageWithKey(keyword, key) {
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=3`,
      { 
        headers: { Authorization: key },
        signal: AbortSignal.timeout(5000) // Tự ngắt sau 5s nếu Pexels quá chậm
      }
    );
    
    if (resp.status === 429) {
      console.warn(`⚠️ Key ${key.substring(0, 5)}... bị giới hạn (Rate Limit)`);
      return null;
    }

    if (!resp.ok) return null;

    const data = await resp.json();
    const photo = data.photos?.find(p => p?.src?.medium);
    return photo?.src?.medium || null;
  } catch (err) {
    console.warn(`⚠️ Lỗi khi gọi Pexels: ${err.message}`);
    return null;
  }
}

// Logic thông minh thử lần lượt các key
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

// Endpoint Batch - Đã tối ưu để không bị Pexels đánh dấu Spam
app.get("/api/pexels/batch", async (req, res) => {
  const raw = (req.query.keywords || "").trim();
  if (!raw) return res.status(400).json({ error: "Missing keywords" });

  const list = [...new Set(raw.split(",").map(k => k.trim().toLowerCase()).filter(Boolean))];
  const results = {};

  // Không dùng Promise.all để tránh bắn 50 requests cùng lúc
  for (const k of list) {
    results[k] = await fetchImageSmart(k);
    // Nghỉ nhẹ 50ms giữa các từ khóa để an toàn cho Key
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  res.json({ images: results });
});

// Quan trọng: Phải lắng nghe trên 0.0.0.0 để Render nhận diện được service
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Pexels Proxy online: http://0.0.0.0:${PORT}`);
  console.log(`🔑 Đang sử dụng ${API_KEYS.length} API Keys`);
});
