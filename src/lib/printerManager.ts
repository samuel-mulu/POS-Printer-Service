import { IPrinterAdapter, PrinterConfig } from "../types";
import { MockAdapter } from "./adapters/mockAdapter";
import { RawUsbAdapter } from "./adapters/rawUsbAdapter";
import { SerialAdapter } from "./adapters/serialAdapter";
import { USBAdapter } from "./adapters/usbAdapter";
import { WindowsRawSpoolAdapter } from "./adapters/windowsRawSpoolAdapter"; // ✅ NEW

export class PrinterManager {
  private adapter: IPrinterAdapter | null = null;
  private readonly config: PrinterConfig;

  constructor(config: PrinterConfig) {
    this.config = config;
    this.initializeAdapter();
  }

  private initializeAdapter(): void {
    if (this.config.interface === "mock") {
      this.adapter = new MockAdapter(this.config.retryDelayMs);

    } else if (this.config.interface === "usb") {
      if (!this.config.usbName) {
        throw new Error('USB printer name is required when PRINTER_INTERFACE is "usb"');
      }
      this.adapter = new USBAdapter(this.config.usbName, this.config.driver);

    } else if (this.config.interface === "raw-usb") {
      this.adapter = new RawUsbAdapter(
        this.config.usbVid,
        this.config.usbPid,
        this.config.usbName,
        this.config.charset
      );

    } else if (this.config.interface === "win-spool-raw") {
      if (!this.config.windowsPrinterName) {
        throw new Error(
          'PRINTER_WINDOWS_NAME is required when PRINTER_INTERFACE is "win-spool-raw"'
        );
      }
      this.adapter = new WindowsRawSpoolAdapter(
        this.config.windowsPrinterName,
        this.config.charset || "PC437"
      );

    } else if (this.config.interface === "serial") {
      if (!this.config.serialPort) {
        throw new Error('Serial port is required when PRINTER_INTERFACE is "serial"');
      }
      this.adapter = new SerialAdapter(this.config.serialPort);

    } else {
      throw new Error(
        `Invalid printer interface: ${this.config.interface}. Must be "usb", "raw-usb", "win-spool-raw", "serial", or "mock"`
      );
    }
  }

  async connect(): Promise<void> {
    if (!this.adapter) throw new Error("Printer adapter is not initialized");
    await this.adapter.connect();
  }

  async disconnect(): Promise<void> {
    if (this.adapter) await this.adapter.disconnect();
  }

  async print(data: string): Promise<void> {
    if (!this.adapter) throw new Error("Printer adapter is not initialized");

    if (!this.adapter.isConnected()) {
      await this.connect();
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.adapter.print(data);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs);
          try {
            await this.disconnect();
            await this.connect();
          } catch (reconnectError) {
            console.warn(`Failed to reconnect before retry ${attempt + 1}:`, reconnectError);
          }
        }
      }
    }

    throw new Error(
      `Print failed after ${this.config.maxRetries} attempts. Last error: ${
        lastError?.message || "Unknown error"
      }`
    );
  }

  isConnected(): boolean {
    return this.adapter?.isConnected() ?? false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}