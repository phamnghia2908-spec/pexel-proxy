import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Lấy 3 key từ biến môi trường
const API_KEYS = [
  process.env.PEXELS_API_KEY_1,
  process.env.PEXELS_API_KEY_2,
  process.env.PEXELS_API_KEY_3
].filter(Boolean);

let preferredKeyIndex = 0;

app.use(cors({ origin: "*" }));

// Hàm gọi ảnh đơn lẻ - Thêm cơ chế tự ngắt (Timeout)
async function fetchImageWithKey(keyword, key) {
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=3`,
      { 
        headers: { Authorization: key },
        // Tự ngắt sau 5 giây nếu không phản hồi
        signal: AbortSignal.timeout(5000) 
      }
    );

    if (resp.status === 429) return null; // Key hết hạn mức tạm thời
    if (!resp.ok) return null;

    const data = await resp.json();
    const photo = data.photos?.find(p => p?.src?.medium);
    return photo?.src?.medium || null;
  } catch (err) {
    return null;
  }
}

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

// Endpoint batch - Sửa từ Promise.all sang xử lý tuần tự để an toàn
app.get("/api/pexels/batch", async (req, res) => {
  const raw = (req.query.keywords || "").trim();
  if (!raw) return res.status(400).json({ error: "Missing keywords" });

  const list = [...new Set(raw.split(",").map(k => k.trim().toLowerCase()).filter(Boolean))];
  const results = {};

  try {
    for (const k of list) {
      results[k] = await fetchImageSmart(k);
      // Nghỉ 50ms giữa các request để tránh bị Pexels quét Spam
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    res.json({ images: results });
  } catch (err) {
    res.status(500).json({ error: "Batch proxy error", details: err.message });
  }
});

// Quan trọng nhất cho Render: Lắng nghe trên 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server đang chạy tại cổng: ${PORT}`);
  console.log(`🔑 Số lượng Key đang hoạt động: ${API_KEYS.length}`);
});
