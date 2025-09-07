// // server.js
// import express from "express";
// import http from "http";
// import https from "https";
// import { createProxyMiddleware } from "http-proxy-middleware";

// // --- Config (env) ---
// const PORT = process.env.PORT || 8080;
// // Lock the proxy to the NoPaperForms API host (do NOT make this dynamic)
// const TARGET_ORIGIN = process.env.NPF_ORIGIN || "https://api.nopaperforms.io";
// // A shared secret header required by your proxy to prevent public abuse
// const PROXY_KEY = process.env.PROXY_KEY; // required

// if (!PROXY_KEY) {
//   console.error("❌ PROXY_KEY is not set. Refusing to start.");
//   process.exit(1);
// }

// // Keep-alive agents for speed
// const httpAgent = new http.Agent({ keepAlive: true });
// const httpsAgent = new https.Agent({ keepAlive: true });

// const app = express();

// // Basic body limit (adjust if needed)
// app.use(express.json({ limit: "1mb" }));
// app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// // Health check
// app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// // Strict allow-list: only forward to NoPaperForms and only allow our secret
// app.use(async (req, res, next) => {
//   const key = req.get("x-proxy-key");
//   if (!key || key !== PROXY_KEY) {
//     return res.status(403).json({ ok: false, error: "Forbidden" });
//   }
//   next();
// });

// // Security: prevent open-proxy abuse (reject absolute URLs, only paths)
// app.use((req, res, next) => {
//   try {
//     // If someone sends an absolute URL, reject
//     const isAbsolute = /^https?:\/\//i.test(req.url);
//     if (isAbsolute) {
//       return res.status(400).json({ ok: false, error: "Absolute URLs not allowed" });
//     }
//     next();
//   } catch (e) {
//     return res.status(400).json({ ok: false, error: "Bad request" });
//   }
// });

// // Proxy everything to NoPaperForms
// app.use(
//   "/",
//   createProxyMiddleware({
//     target: TARGET_ORIGIN,
//     changeOrigin: true,
//     secure: true,
//     xfwd: true,
//     followRedirects: true,
//     // Use keep-alive agents to reduce latency
//     agent: TARGET_ORIGIN.startsWith("https:") ? httpsAgent : httpAgent,
//     onProxyReq: (proxyReq, req, _res) => {
//       // Force Host header to target origin
//       proxyReq.setHeader("host", new URL(TARGET_ORIGIN).host);

//       // Optional: ensure JSON requests carry correct content-type
//       // (Your client should already set these, but this is safe)
//       if (req.is("application/json")) {
//         proxyReq.setHeader("content-type", "application/json");
//       }
//     },
//     onError: (err, _req, res) => {
//       console.error("❌ Proxy error:", err?.message || err);
//       res.writeHead(502, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ ok: false, error: "Upstream error" }));
//     },
//   })
// );

// // Log our public egress IP (useful for whitelisting validation)
// async function logPublicIP() {
//   try {
//     const controller = new AbortController();
//     const t = setTimeout(() => controller.abort(), 5000);
//     const r = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
//     clearTimeout(t);
//     const j = await r.json();
//     console.log("🌐 Public egress IP (as seen by ipify):", j.ip);
//   } catch (e) {
//     console.warn("⚠️ Could not fetch public IP:", e?.message || e);
//   }
// }

// app.listen(PORT, async () => {
//   console.log(`🚀 Proxy listening on :${PORT} → ${TARGET_ORIGIN}`);
//   await logPublicIP();
// });



// server.js
import express from "express";
import http from "http";
import https from "https";
import { createProxyMiddleware } from "http-proxy-middleware";

const PORT = process.env.PORT || 8080;
const TARGET_ORIGIN = process.env.NPF_ORIGIN || "https://api.nopaperforms.io";
const PROXY_KEY = process.env.PROXY_KEY;

if (!PROXY_KEY) {
  console.error("❌ PROXY_KEY is not set. Refusing to start.");
  process.exit(1);
}

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const app = express();

// Health check
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Secret check
app.use((req, res, next) => {
  const key = req.get("x-proxy-key");
  if (!key || key !== PROXY_KEY) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
});

// Prevent abuse (absolute URLs)
app.use((req, res, next) => {
  if (/^https?:\/\//i.test(req.url)) {
    return res.status(400).json({ ok: false, error: "Absolute URLs not allowed" });
  }
  next();
});

// Proxy to NoPaperForms
app.use(
  "/",
  createProxyMiddleware({
    target: TARGET_ORIGIN,
    changeOrigin: true,
    secure: true,
    xfwd: true,
    followRedirects: true,
    agent: TARGET_ORIGIN.startsWith("https:") ? httpsAgent : httpAgent,
    pathRewrite: (path, req) => {
      // Ensure correct joining (remove accidental double slashes)
      return path.replace(/^\/+/, "/");
    },
    onProxyReq: (proxyReq, req, _res) => {
      proxyReq.setHeader("host", new URL(TARGET_ORIGIN).host);
    },
    onError: (err, _req, res) => {
      console.error("❌ Proxy error:", err?.message || err);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Proxy upstream error" }));
    },
  })
);

async function logPublicIP() {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    console.log("🌐 Public egress IP (as seen by ipify):", j.ip);
  } catch (e) {
    console.warn("⚠️ Could not fetch public IP:", e?.message || e);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Proxy listening on :${PORT} → ${TARGET_ORIGIN}`);
  await logPublicIP();
});
