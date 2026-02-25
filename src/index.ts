import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import http from "http";
import https from "https";
import morgan from "morgan";
import path from "path";

import { PrinterManager } from "./lib/printerManager";
import { PrintQueue } from "./lib/printQueue";
import { PrintResponse, PrinterConfig } from "./types";

// Load environment variables
dotenv.config();

const app = express();
app.disable("x-powered-by");

// ---- Config ----
const PORT = parseInt(process.env.PORT || "7777", 10);

const NODE_ENV = process.env.NODE_ENV || "development";
const isDevelopment =
  NODE_ENV === "development" ||
  process.env.DEV_MODE === "true" ||
  !process.env.NODE_ENV;

const PRINT_KEY =
  process.env.PRINT_KEY || (isDevelopment ? "dev-key-12345" : undefined);

const ENABLE_HTTPS = process.env.ENABLE_HTTPS === "true";
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH;
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH;

// Comma-separated origins, e.g.
// ALLOWED_ORIGINS=https://frontend-restaurant-web-app.vercel.app,http://localhost:3000
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://frontend-restaurant-web-app.vercel.app",
];

// Validate required environment variables (only in production)
if (!PRINT_KEY && !isDevelopment) {
  console.error(
    "ERROR: PRINT_KEY environment variable is required in production"
  );
  process.exit(1);
}

if (ENABLE_HTTPS && (!HTTPS_KEY_PATH || !HTTPS_CERT_PATH)) {
  console.error(
    "ERROR: ENABLE_HTTPS=true but HTTPS_KEY_PATH or HTTPS_CERT_PATH not set"
  );
  process.exit(1);
}

// ---- Initialize printer manager ----
let printerManager: PrinterManager;

  try {
    let selectedInterface =
      (process.env.PRINTER_INTERFACE as "usb" | "raw-usb" | "win-spool-raw" | "serial" | "mock") || "usb";

    // In dev: fall back to mock if missing config
    if (isDevelopment) {
      if (selectedInterface === "usb" && !process.env.PRINTER_USB_NAME) {
        console.warn(
          "⚠️  PRINTER_INTERFACE=usb but PRINTER_USB_NAME is not set. Falling back to mock printer."
        );
        selectedInterface = "mock";
      } else if (selectedInterface === "raw-usb" && !process.env.PRINTER_USB_VID && !process.env.PRINTER_USB_PID) {
        console.warn(
          "⚠️  PRINTER_INTERFACE=raw-usb but PRINTER_USB_VID/PID are not set. Falling back to mock printer."
        );
        selectedInterface = "mock";
      } else if (selectedInterface === "win-spool-raw" && !process.env.PRINTER_WINDOWS_NAME) {
        console.warn(
          "⚠️  PRINTER_INTERFACE=win-spool-raw but PRINTER_WINDOWS_NAME is not set. Falling back to mock printer."
        );
        selectedInterface = "mock";
      } else if (
        selectedInterface === "serial" &&
        !process.env.PRINTER_SERIAL_PORT
      ) {
        console.warn(
          "⚠️  PRINTER_INTERFACE=serial but PRINTER_SERIAL_PORT is not set. Falling back to mock printer."
        );
        selectedInterface = "mock";
      } else if (!process.env.PRINTER_INTERFACE) {
        selectedInterface = "mock";
      }
    }

    const printerConfig: PrinterConfig = {
      interface: selectedInterface as any,
      usbName: process.env.PRINTER_USB_NAME,
      usbVid: process.env.PRINTER_USB_VID ? parseInt(process.env.PRINTER_USB_VID, 16) : undefined,
      usbPid: process.env.PRINTER_USB_PID ? parseInt(process.env.PRINTER_USB_PID, 16) : undefined,
      windowsPrinterName: process.env.PRINTER_WINDOWS_NAME,
      charset: process.env.PRINTER_CHARSET || "cp437",
      serialPort: process.env.PRINTER_SERIAL_PORT,
      driver: process.env.PRINTER_DRIVER,
      maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || "1000", 10),
    };

  printerManager = new PrinterManager(printerConfig);

  if (isDevelopment && printerConfig.interface === "mock") {
    console.log("🔧 DEVELOPMENT MODE: Using mock printer adapter");
    console.log("   Print jobs will be logged to console instead of printing");
    console.log(`   Default PRINT_KEY: ${PRINT_KEY}`);
  }

  console.log(
    `Printer Manager initialized with interface: ${printerConfig.interface}`
  );
} catch (error) {
  console.error("ERROR: Failed to initialize printer manager:", error);
  process.exit(1);
}

// ---- Print queue ----
const printQueue = new PrintQueue((data: string) => printerManager.print(data));
console.log("📋 Print queue initialized - Jobs will be processed sequentially");

// ---- Middleware ----

// Basic security headers (simple)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// CORS allowlist
app.use(
  cors({
    origin: (origin, cb) => {
      // allow tools (curl/postman) with no Origin
      if (!origin) return cb(null, true);

      const allowed = new Set([...defaultDevOrigins, ...ALLOWED_ORIGINS]);

      if (allowed.has(origin)) return cb(null, true);

      // in dev allow everything (optional)
      if (isDevelopment) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Print-Key"],
  })
);

// ✅ FIX: preflight for all routes (avoid "*" crash)
app.options(/.*/, cors());

app.use(morgan(isDevelopment ? "dev" : "combined"));
app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: "text/plain", limit: "1mb" }));

// ---- Helpers ----
function validatePrintKey(req: Request): boolean {
  const headerKey =
    (req.headers["x-print-key"] as string) ||
    (req.headers["X-Print-Key"] as string);

  if (headerKey && headerKey === PRINT_KEY) return true;

  if (
    req.body &&
    typeof req.body === "object" &&
    (req.body as any).key === PRINT_KEY
  ) {
    return true;
  }

  if (isDevelopment) {
    console.log("🔍 [DEBUG] Print key validation failed:");
    console.log(`   Expected key: ${PRINT_KEY}`);
    console.log(`   Header key received: ${headerKey || "(not provided)"}`);
    console.log(
      `   Body key received: ${(req.body as any)?.key || "(not provided)"}`
    );
  }

  return false;
}

function extractPrintData(
  req: Request
): { ok: true; data: string } | { ok: false; error: string } {
  if (typeof req.body === "string") {
    const t = req.body;
    if (!t || t.trim().length === 0)
      return { ok: false, error: "Print data cannot be empty" };
    return { ok: true, data: t };
  }

  if (req.body && typeof req.body === "object") {
    const d = (req.body as any).data;
    if (typeof d !== "string" || d.trim().length === 0) {
      return { ok: false, error: 'Print data is required in "data" field' };
    }
    return { ok: true, data: d };
  }

  return { ok: false, error: "Print data is required" };
}

// ---- Routes ----

// Serve companion UI
app.use("/ui", express.static(path.join(__dirname, "../public/ui")));

// Redirect root to UI
app.get("/", (req, res) => {
  res.redirect("/ui");
});

/**
 * ✅ KISS: Minimal config endpoints expected by your frontend dashboard
 * They reflect .env values and avoid 404s.
 */
app.get("/config", (req: Request, res: Response) => {
  res.json({
    success: true,
    config: {
      interface:
        (process.env.PRINTER_INTERFACE as "usb" | "serial" | "mock") || "usb",
      usbName: process.env.PRINTER_USB_NAME || null,
      serialPort: process.env.PRINTER_SERIAL_PORT || null,
      maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || "1000", 10),
    },
  });
});

app.get("/config/available", (req: Request, res: Response) => {
  // KISS: return empty lists (UI won't break). You can enhance later.
  res.json({
    usbPrinters: [],
    serialPorts: [],
  });
});

app.post("/print", async (req: Request, res: Response) => {
  try {
    if (!validatePrintKey(req)) {
      const response: PrintResponse = {
        success: false,
        message: "Unauthorized",
        error: "Invalid or missing print key",
      };
      return res.status(401).json(response);
    }

    const extracted = extractPrintData(req);
    if (!extracted.ok) {
      const response: PrintResponse = {
        success: false,
        message: "Invalid request",
        error: extracted.error,
      };
      return res.status(400).json(response);
    }

    const queuePosition = printQueue.getQueueLength();
    const isProcessing = printQueue.isProcessing();

    console.log(
      `📥 [QUEUE] New print job received (Queue position: ${
        queuePosition + 1
      }, Processing: ${isProcessing})`
    );

    await printQueue.enqueue(extracted.data);

    const response: PrintResponse = {
      success: true,
      message: "Print job completed successfully",
    };

    res.json(response);
  } catch (error) {
    console.error("Print error:", error);
    const response: PrintResponse = {
      success: false,
      message: "Print job failed",
      error: error instanceof Error ? error.message : String(error),
    };
    res.status(500).json(response);
  }
});

app.get("/health", (req: Request, res: Response) => {
  const isConnected = printerManager.isConnected();
  const queueLength = printQueue.getQueueLength();
  const isProcessing = printQueue.isProcessing();

  res.json({
    status: "ok",
    env: NODE_ENV,
    https: ENABLE_HTTPS,
    printerConnected: isConnected,
    queue: {
      length: queueLength,
      processing: isProcessing,
    },
    timestamp: new Date().toISOString(),
  });
});

// ---- Error handling ----
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  const response: PrintResponse = {
    success: false,
    message: "Internal server error",
    error: isDevelopment ? err.message : "Internal server error",
  };
  res.status(500).json(response);
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Not found",
    error: `Route ${req.path} not found`,
  });
});

// ---- Start server ----
async function startServer() {
  try {
    // Connect printer on startup
    try {
      await printerManager.connect();
      console.log("Printer connected successfully");
    } catch (error) {
      console.warn("Warning: Could not connect to printer on startup:", error);
      console.warn(
        "Service will continue, but print jobs may fail until printer is connected"
      );
    }

    const protocol = ENABLE_HTTPS ? "https" : "http";

    let server: http.Server | https.Server;

    if (ENABLE_HTTPS) {
      const key = fs.readFileSync(HTTPS_KEY_PATH!, "utf8");
      const cert = fs.readFileSync(HTTPS_CERT_PATH!, "utf8");
      server = https.createServer({ key, cert }, app);
    } else {
      server = http.createServer(app);
    }

    server.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log(`✅ POS Printer Service running on port ${PORT}`);
      console.log("=".repeat(60));
      console.log(`📝 Print endpoint: ${protocol}://127.0.0.1:${PORT}/print`);
      console.log(`❤️  Health check: ${protocol}://127.0.0.1:${PORT}/health`);
      console.log(`🧩 Local UI: ${protocol}://127.0.0.1:${PORT}/ui`);

      if (isDevelopment) {
        console.log(`\n🔑 Current PRINT_KEY: ${PRINT_KEY}`);
      } else {
        console.log("\n🔑 PRINT_KEY: (hidden in production logs)");
      }

      console.log("=".repeat(60) + "\n");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  try {
    await printerManager.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();