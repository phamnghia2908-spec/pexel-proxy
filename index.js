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

let preferredKeyIndex = 0; // key đang được ưu tiên

app.use(cors({ origin: "*", methods: ["GET"] }));

// Gọi ảnh với 1 key, duyệt qua ảnh để tìm ảnh hợp lệ
async function fetchImageWithKey(keyword, key) {
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=5`,
      { headers: { Authorization: key } }
    );
    if (!resp.ok) {
      console.warn(`Key failed: ${key} → status ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const photo = data.photos?.find(p => p?.src?.medium);
    return photo?.src?.medium || null;
  } catch (err) {
    console.warn(`Fetch error with key ${key}:`, err.message);
    return null;
  }
}

// Gọi ảnh thông minh: thử từng key cho đến khi có ảnh
async function fetchImageSmart(keyword) {
  for (let i = 0; i < API_KEYS.length; i++) {
    const index = (preferredKeyIndex + i) % API_KEYS.length;
    const key = API_KEYS[index];
    const url = await fetchImageWithKey(keyword, key);
    if (url) {
      preferredKeyIndex = index; // cập nhật key ưu tiên
      return url;
    }
  }
  return null;
}

// Endpoint batch
app.get("/api/pexels/batch", async (req, res) => {
  const raw = (req.query.keywords || "").trim();
  if (!raw) return res.status(400).json({ error: "Missing keywords" });

  const list = [...new Set(raw.split(",").map(k => k.trim().toLowerCase()).filter(Boolean))];

  try {
    const results = await Promise.all(
      list.map(async (k) => {
        const url = await fetchImageSmart(k);
        return [k, url];
      })
    );
    res.json({ images: Object.fromEntries(results) });
  } catch (err) {
    res.status(500).json({ error: "Batch proxy error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Pexels proxy running on port ${PORT}`);
});
