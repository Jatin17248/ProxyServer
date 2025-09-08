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
app.use(express.json()); // ensure JSON bodies are parsed

// Health check
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

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

// Security: require proxy key and strip cookies
app.use((req, res, next) => {
  delete req.headers["cookie"]; // strip cookies entirely

  const key = req.get("x-proxy-key");
  if (!key || key !== PROXY_KEY) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
});


// Dedicated endpoint for lead creation/update
app.post("/lead/v1/createOrUpdate", async (req, res) => {
  try {
    console.log("=== Forwarding to NPF ===");
    console.log("Request body:", req.body);

    const response = await axios.post(
      `${TARGET_ORIGIN}/lead/v1/createOrUpdate`,
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
    console.error("❌ Error from NPF:", err.response?.status, err.response?.data);
    res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: "Unknown error" });
  }
});


// Proxy middleware for general passthrough
app.use(
  "/",
  createProxyMiddleware({
    target: TARGET_ORIGIN,
    changeOrigin: true,
    secure: true,
    xfwd: true,
    logLevel: "debug",
    onProxyReq: (proxyReq, req) => {
      console.log("➡️ Incoming Request:", {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
      });

      // Forward all headers as-is (cookies already stripped)
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
  console.log(`🔑 Proxy Key: ${PROXY_KEY ? "***set***" : "missing"}`);
  console.log(`🔑 NPF_ACCESS_KEY: ${process.env.NPF_ACCESS_KEY ? "***set***" : "missing"}`);
  console.log(`🔑 NPF_SECRET_KEY: ${process.env.NPF_SECRET_KEY ? "***set***" : "missing"}`);
  await logPublicIP();
});
