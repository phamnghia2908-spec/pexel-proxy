import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors({ origin: "*" }));

const API_KEYS = [
  process.env.PEXELS_API_KEY_1,
  process.env.PEXELS_API_KEY_2,
  process.env.PEXELS_API_KEY_3
].filter(Boolean);

// Hàm lấy ảnh đơn lẻ
async function fetchImageWithKey(keyword, key) {
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1`,
      { headers: { Authorization: key }, timeout: 5000 }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.photos?.[0]?.src?.medium || null;
  } catch (err) {
    return null;
  }
}

// Endpoint Batch đã được tối ưu tốc độ để tránh bị Pexels chặn
app.get("/api/pexels/batch", async (req, res) => {
  const raw = (req.query.keywords || "").trim();
  if (!raw) return res.status(400).json({ error: "Missing keywords" });

  const list = [...new Set(raw.split(",").map(k => k.trim().toLowerCase()).filter(Boolean))];
  const images = {};

  // Chọn ngẫu nhiên key bắt đầu để phân phối tải đều hơn giữa 3 key
  let keyIndex = Math.floor(Math.random() * API_KEYS.length);

  // Dùng vòng lặp thường thay vì Promise.all để tránh bị đánh dấu Spam
  for (const kw of list) {
    let found = false;
    // Thử các key hiện có
    for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
      const currentKey = API_KEYS[(keyIndex + attempt) % API_KEYS.length];
      const url = await fetchImageWithKey(kw, currentKey);
      
      if (url) {
        images[kw] = url;
        keyIndex = (keyIndex + attempt) % API_KEYS.length; // Giữ key đang chạy tốt
        found = true;
        break; 
      }
    }
    if (!found) images[kw] = null;
    
    // Nghỉ 100ms giữa mỗi lần gọi để "qua mắt" bộ lọc của Pexels
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  res.json({ images });
});

export default app; // Quan trọng để chạy trên Vercel
