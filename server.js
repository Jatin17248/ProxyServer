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

// // server.js
// import express from "express";
// import http from "http";
// import https from "https";
// import { createProxyMiddleware } from "http-proxy-middleware";

// const PORT = process.env.PORT || 8080;
// const TARGET_ORIGIN = process.env.NPF_ORIGIN || "https://api.nopaperforms.io";
// const PROXY_KEY = process.env.PROXY_KEY;

// if (!PROXY_KEY) {
//   console.error("❌ PROXY_KEY is not set. Refusing to start.");
//   process.exit(1);
// }

// const httpAgent = new http.Agent({ keepAlive: true });
// const httpsAgent = new https.Agent({ keepAlive: true });

// const app = express();

// // Health check
// app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// // Debug endpoint to test NPF credentials
// app.get("/test-npf", async (req, res) => {
//   try {
//     console.log("🧪 Testing direct NPF API call...");

//     const headers = {
//       'access-key': process.env.NPF_ACCESS_KEY || '',
//       'secret-key': process.env.NPF_SECRET_KEY || '',
//       'Content-Type': 'application/json',
//       'User-Agent': 'NPF-Proxy-Test/1.0'
//     };

//     console.log("🧪 Sending headers:", headers);

//     const response = await fetch(`${TARGET_ORIGIN}/lead`, {
//       method: 'GET',
//       headers: headers
//     });

//     const responseText = await response.text();

//     console.log("🧪 Direct NPF test result:", {
//       status: response.status,
//       statusText: response.statusText,
//       headers: Object.fromEntries(response.headers.entries()),
//       body: responseText
//     });

//     res.json({
//       status: response.status,
//       statusText: response.statusText,
//       headers: Object.fromEntries(response.headers.entries()),
//       body: responseText,
//       credentials: {
//         hasAccessKey: !!process.env.NPF_ACCESS_KEY,
//         hasSecretKey: !!process.env.NPF_SECRET_KEY,
//         accessKeyLength: process.env.NPF_ACCESS_KEY?.length || 0,
//         secretKeyLength: process.env.NPF_SECRET_KEY?.length || 0,
//         accessKeyPreview: process.env.NPF_ACCESS_KEY ?
//           `${process.env.NPF_ACCESS_KEY.substring(0, 4)}...${process.env.NPF_ACCESS_KEY.substring(-4)}` : 'missing',
//         secretKeyPreview: process.env.NPF_SECRET_KEY ?
//           `${process.env.NPF_SECRET_KEY.substring(0, 4)}...${process.env.NPF_SECRET_KEY.substring(-4)}` : 'missing'
//       }
//     });
//   } catch (error) {
//     console.error("🧪 Direct NPF test failed:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Test proxy endpoint (bypasses secret check for testing)
// app.get("/test-proxy", async (req, res) => {
//   try {
//     console.log("🧪 Testing proxy functionality...");

//     // Make a request through the proxy to itself
//     const proxyUrl = `http://localhost:${PORT}/lead`;
//     const response = await fetch(proxyUrl, {
//       method: 'GET',
//       headers: {
//         'x-proxy-key': PROXY_KEY,
//         'Content-Type': 'application/json'
//       }
//     });

//     const responseText = await response.text();

//     console.log("🧪 Proxy test result:", {
//       status: response.status,
//       statusText: response.statusText,
//       headers: Object.fromEntries(response.headers.entries()),
//       body: responseText
//     });

//     res.json({
//       status: response.status,
//       statusText: response.statusText,
//       headers: Object.fromEntries(response.headers.entries()),
//       body: responseText,
//       proxyKey: PROXY_KEY ? "***set***" : "missing"
//     });
//   } catch (error) {
//     console.error("🧪 Proxy test failed:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Secret check
// app.use((req, res, next) => {
//   const key = req.get("x-proxy-key");
//   if (!key || key !== PROXY_KEY) {
//     return res.status(403).json({ ok: false, error: "Forbidden" });
//   }
//   next();
// });

// // Prevent abuse (absolute URLs)
// app.use((req, res, next) => {
//   if (/^https?:\/\//i.test(req.url)) {
//     return res.status(400).json({ ok: false, error: "Absolute URLs not allowed" });
//   }
//   next();
// });

// // Proxy to NoPaperForms
// app.use(
//   "/",
//   createProxyMiddleware({
//     target: TARGET_ORIGIN,
//     changeOrigin: true,
//     secure: true,
//     xfwd: true,
//     followRedirects: true,
//     agent: TARGET_ORIGIN.startsWith("https:") ? httpsAgent : httpAgent,
//     pathRewrite: (path, req) => {
//       // Ensure correct joining (remove accidental double slashes)
//       return path.replace(/^\/+/, "/");
//     },
//     onProxyReq: (proxyReq, req, _res) => {
//       // Force Host header to target origin
//       proxyReq.setHeader("host", new URL(TARGET_ORIGIN).host);

//       // Add NPF API credentials - use exact header names NPF expects
//       if (process.env.NPF_ACCESS_KEY) {
//         proxyReq.setHeader("access-key", process.env.NPF_ACCESS_KEY);
//       }
//       if (process.env.NPF_SECRET_KEY) {
//         proxyReq.setHeader("secret-key", process.env.NPF_SECRET_KEY);
//       }

//       // Preserve original content-type if present
//       if (req.get("content-type")) {
//         proxyReq.setHeader("content-type", req.get("content-type"));
//       } else if (req.is("application/json")) {
//         proxyReq.setHeader("content-type", "application/json");
//       }

//       // Preserve other important headers from original request
//       if (req.get("user-agent")) {
//         proxyReq.setHeader("user-agent", req.get("user-agent"));
//       }
//       if (req.get("accept")) {
//         proxyReq.setHeader("accept", req.get("accept"));
//       }

//       // Log ALL headers being sent to NPF for debugging
//       console.log("➡️ Proxying to NPF:", {
//         method: req.method,
//         url: req.url,
//         target: TARGET_ORIGIN,
//         allHeaders: proxyReq.getHeaders()
//       });

//       // Specifically log the credential headers
//       console.log("🔑 Credential Headers:", {
//         "access-key": proxyReq.getHeader("access-key") || "MISSING",
//         "secret-key": proxyReq.getHeader("secret-key") || "MISSING"
//       });
//     },
//     onProxyRes: (proxyRes, req, res) => {
//       console.log("📤 NPF Response:", {
//         statusCode: proxyRes.statusCode,
//         statusMessage: proxyRes.statusMessage,
//         headers: proxyRes.headers
//       });

//       // If it's an error response, log the body
//       if (proxyRes.statusCode >= 400) {
//         let body = '';
//         proxyRes.on('data', (chunk) => {
//           body += chunk;
//         });
//         proxyRes.on('end', () => {
//           console.log("❌ NPF Error Response Body:", body);
//         });
//       }
//     },
//     onError: (err, _req, res) => {
//       console.error("❌ Proxy error:", err?.message || err);
//       res.writeHead(502, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ ok: false, error: "Proxy upstream error" }));
//     },
//   })
// );

// async function logPublicIP() {
//   try {
//     const r = await fetch("https://api.ipify.org?format=json");
//     const j = await r.json();
//     console.log("🌐 Public egress IP (as seen by ipify):", j.ip);
//   } catch (e) {
//     console.warn("⚠️ Could not fetch public IP:", e?.message || e);
//   }
// }

// app.listen(PORT, async () => {
//   console.log(`🚀 Proxy listening on :${PORT} → ${TARGET_ORIGIN}`);
//   console.log(`🔑 PROXY_KEY: ${PROXY_KEY ? "***set***" : "missing"}`);
//   console.log(`🔑 NPF_ACCESS_KEY: ${process.env.NPF_ACCESS_KEY ? "***set***" : "missing"}`);
//   console.log(`🔑 NPF_SECRET_KEY: ${process.env.NPF_SECRET_KEY ? "***set***" : "missing"}`);
//   await logPublicIP();
// });

// import express from "express";
// import { createProxyMiddleware } from "http-proxy-middleware";

// const PORT = process.env.PORT || 8080;
// const TARGET_ORIGIN = process.env.NPF_ORIGIN || "https://api.nopaperforms.io";
// const PROXY_KEY = process.env.PROXY_KEY;

// if (!PROXY_KEY) {
//   console.error("❌ PROXY_KEY is not set. Refusing to start.");
//   process.exit(1);
// }

// const app = express();

// // Health check
// app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// // Require x-proxy-key
// app.use((req, res, next) => {
//   const key = req.get("x-proxy-key");
//   if (!key || key !== PROXY_KEY) {
//     return res.status(403).json({ ok: false, error: "Forbidden" });
//   }
//   next();
// });

// // Proxy middleware
// app.use(
//   "/",
//   createProxyMiddleware({
//     target: TARGET_ORIGIN,
//     changeOrigin: true,
//     secure: true,
//     xfwd: true,
//     logLevel: "debug", // useful for troubleshooting
//     onProxyReq: (proxyReq, req) => {
//       console.log(`➡️ Forwarding ${req.method} ${req.url} → ${TARGET_ORIGIN}`);
//       // Copy all headers from incoming request
//       Object.entries(req.headers).forEach(([header, value]) => {
//         if (value) proxyReq.setHeader(header, value);
//       });
//     },
//     onProxyRes: (proxyRes, req) => {
//       console.log(`📤 Response from ${TARGET_ORIGIN}: ${proxyRes.statusCode}`);
//     },
//     onError: (err, _req, res) => {
//       console.error("❌ Proxy error:", err?.message || err);
//       res.writeHead(502, { "Content-Type": "application/json" });
//       res.end(JSON.stringify({ ok: false, error: "Proxy upstream error" }));
//     },
//   })
// );

// app.listen(PORT, () => {
//   console.log(`🚀 Proxy listening on :${PORT} → ${TARGET_ORIGIN}`);
// });

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import axios from "axios";
import https from "https";

const PORT = process.env.PORT || 8080;
const TARGET_ORIGIN = process.env.NPF_ORIGIN || "https://api.nopaperforms.io";
const PROXY_KEY = process.env.PROXY_KEY;

const ipv4Agent = new https.Agent({ family: 4 });

if (!PROXY_KEY) {
  console.error("❌ PROXY_KEY is not set. Refusing to start.");
  process.exit(1);
}

const app = express();

// Health check
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Debug endpoint - returns headers as seen by proxy
// Debug endpoint - returns headers and request IP
app.get("/debug-headers", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  console.log("=== Incoming Debug Request ===");
  console.log("IP:", ip);
  console.log("Headers:", req.headers);

  res.json({
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    ip,
  });
});

// Security: require proxy key
app.use((req, res, next) => {
  const key = req.get("x-proxy-key");
  delete req.headers["cookie"]; // strip cookies entirely
  if (!key || key !== PROXY_KEY) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
});

// Proxy middleware
app.use(
  "/",
  createProxyMiddleware({
    target: TARGET_ORIGIN,
    changeOrigin: true,
    secure: true,
    xfwd: true,
    logLevel: "debug",
    onProxyReq: (proxyReq, req) => {
      // Log request details
      console.log("➡️ Incoming Request:", {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
      });

      // Forward all headers as-is
      Object.entries(req.headers).forEach(([header, value]) => {
        if (value) proxyReq.setHeader(header, value);
      });
    },
    onProxyRes: (proxyRes, req) => {
      console.log(`📤 Response from ${TARGET_ORIGIN}: ${proxyRes.statusCode}`);
    },
    onError: (err, _req, res) => {
      console.error("❌ Proxy error:", err?.message || err);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Proxy upstream error" }));
    },
  })
);

app.post("/lead/v1/createOrUpdate", async (req, res) => {
  try {
    console.log("=== Forwarding to NPF ===");
    console.log("Request body:", req.body);

    const response = await axios.post(
      "https://api.nopaperforms.io/lead/v1/createOrUpdate",
      req.body,
      {
        headers: {
          "access-key": process.env.NPF_ACCESS_KEY,
          "secret-key": process.env.NPF_SECRET_KEY,
          "Content-Type": "application/json",
        },
        httpsAgent: ipv4Agent,
      }
    );

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error("Error from NPF:", err.response?.status, err.response?.data);
    res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: "Unknown error" });
  }
});

// Log egress IP
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
