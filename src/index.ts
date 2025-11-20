import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { PrinterManager } from "./lib/printerManager";
import { PrintQueue } from "./lib/printQueue";
import { PrintRequest, PrintResponse, PrinterConfig } from "./types";

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "7777", 10);

// Check if we're in development mode
const isDevelopment =
  process.env.NODE_ENV === "development" ||
  process.env.DEV_MODE === "true" ||
  !process.env.NODE_ENV;

// Use default print key in development mode
const PRINT_KEY =
  process.env.PRINT_KEY || (isDevelopment ? "dev-key-12345" : undefined);

// Validate required environment variables (only in production)
if (!PRINT_KEY && !isDevelopment) {
  console.error("ERROR: PRINT_KEY environment variable is required");
  process.exit(1);
}

// Initialize printer manager
let printerManager: PrinterManager;

try {
  // Determine the interface to use
  let selectedInterface =
    (process.env.PRINTER_INTERFACE as "usb" | "serial" | "mock") || "usb";

  // In development mode, check if required config is missing and fall back to mock
  if (isDevelopment) {
    if (selectedInterface === "usb" && !process.env.PRINTER_USB_NAME) {
      console.warn(
        "⚠️  PRINTER_INTERFACE=usb but PRINTER_USB_NAME is not set. Falling back to mock printer."
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
      // No interface specified, default to mock in dev
      selectedInterface = "mock";
    }
  }

  const printerConfig: PrinterConfig = {
    interface: selectedInterface,
    usbName: process.env.PRINTER_USB_NAME,
    serialPort: process.env.PRINTER_SERIAL_PORT,
    maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || "1000", 10),
  };

  printerManager = new PrinterManager(printerConfig);

  if (isDevelopment && printerConfig.interface === "mock") {
    console.log("🔧 DEVELOPMENT MODE: Using mock printer adapter");
    console.log("   Print jobs will be logged to console instead of printing");
    console.log(`   Default PRINT_KEY: ${PRINT_KEY}`);
    console.log(
      "   To use a real printer, set PRINTER_INTERFACE=usb or PRINTER_INTERFACE=serial"
    );
  }

  console.log(
    `Printer Manager initialized with interface: ${printerConfig.interface}`
  );
} catch (error) {
  console.error("ERROR: Failed to initialize printer manager:", error);
  process.exit(1);
}

// Initialize print queue to handle concurrent requests
const printQueue = new PrintQueue((data: string) => {
  return printerManager.print(data);
});
console.log("📋 Print queue initialized - Jobs will be processed sequentially");

// Middleware
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.text({ type: "text/plain" }));

/**
 * Validate print key from request
 */
function validatePrintKey(req: Request): boolean {
  // Check header first (case-insensitive)
  const headerKey =
    (req.headers["x-print-key"] as string) ||
    (req.headers["X-Print-Key"] as string);

  if (headerKey && headerKey === PRINT_KEY) {
    return true;
  }

  // Check body if it's a PrintRequest
  if (req.body && typeof req.body === "object" && req.body.key === PRINT_KEY) {
    return true;
  }

  // Debug logging in development mode
  if (isDevelopment) {
    console.log("🔍 [DEBUG] Print key validation failed:");
    console.log(`   Expected key: ${PRINT_KEY}`);
    console.log(`   Header key received: ${headerKey || "(not provided)"}`);
    console.log(`   Body key received: ${req.body?.key || "(not provided)"}`);
  }

  return false;
}

/**
 * POST /print - Print receipt
 */
app.post("/print", async (req: Request, res: Response) => {
  try {
    // Validate authentication
    if (!validatePrintKey(req)) {
      const response: PrintResponse = {
        success: false,
        message: "Unauthorized",
        error: "Invalid or missing print key",
      };
      return res.status(401).json(response);
    }

    // Extract print data
    let printData: string;

    if (typeof req.body === "string") {
      // Plain text body
      printData = req.body;
    } else if (req.body && typeof req.body === "object") {
      // JSON body with data field
      if (req.body.data && typeof req.body.data === "string") {
        printData = req.body.data;
      } else {
        const response: PrintResponse = {
          success: false,
          message: "Invalid request",
          error: 'Print data is required in "data" field',
        };
        return res.status(400).json(response);
      }
    } else {
      const response: PrintResponse = {
        success: false,
        message: "Invalid request",
        error: "Print data is required",
      };
      return res.status(400).json(response);
    }

    if (!printData || printData.trim().length === 0) {
      const response: PrintResponse = {
        success: false,
        message: "Invalid request",
        error: "Print data cannot be empty",
      };
      return res.status(400).json(response);
    }

    // Get queue position before adding
    const queuePosition = printQueue.getQueueLength();
    const isProcessing = printQueue.isProcessing();

    // Add print job to queue (will be processed sequentially)
    console.log(
      `📥 [QUEUE] New print job received (Queue position: ${
        queuePosition + 1
      }, Processing: ${isProcessing})`
    );

    // Execute print job through queue
    await printQueue.enqueue(printData);

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

/**
 * GET /health - Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
  const isConnected = printerManager.isConnected();
  const queueLength = printQueue.getQueueLength();
  const isProcessing = printQueue.isProcessing();

  res.json({
    status: "ok",
    printerConnected: isConnected,
    queue: {
      length: queueLength,
      processing: isProcessing,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Error handling middleware
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  const response: PrintResponse = {
    success: false,
    message: "Internal server error",
    error: err.message,
  };
  res.status(500).json(response);
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Not found",
    error: `Route ${req.path} not found`,
  });
});

/**
 * Start server
 */
async function startServer() {
  try {
    // Try to connect to printer on startup
    try {
      await printerManager.connect();
      console.log("Printer connected successfully");
    } catch (error) {
      console.warn("Warning: Could not connect to printer on startup:", error);
      console.warn(
        "Service will continue, but print jobs may fail until printer is connected"
      );
    }

    app.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log(`✅ POS Printer Service running on port ${PORT}`);
      console.log("=".repeat(60));
      console.log(`📝 Print endpoint: http://localhost:${PORT}/print`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
      console.log(`\n🔑 Current PRINT_KEY: ${PRINT_KEY}`);
      if (isDevelopment) {
        console.log(`   ⚠️  Development mode active`);
        console.log("   Example request:");
        console.log(`   curl -X POST http://localhost:${PORT}/print \\`);
        console.log(`     -H "Content-Type: application/json" \\`);
        console.log(`     -H "X-Print-Key: ${PRINT_KEY}" \\`);
        console.log(`     -d '{"data": "Test Receipt\\nLine 1\\nLine 2"}'`);
      }
      console.log("=".repeat(60) + "\n");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  try {
    await printerManager.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  try {
    await printerManager.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

// Start the server
startServer();
