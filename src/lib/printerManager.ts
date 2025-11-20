import { IPrinterAdapter, PrinterConfig } from '../types';
import { USBAdapter } from './adapters/usbAdapter';
import { SerialAdapter } from './adapters/serialAdapter';
import { MockAdapter } from './adapters/mockAdapter';

/**
 * Printer Manager - Handles printer adapter selection, retry logic, and print execution
 */
export class PrinterManager {
  private adapter: IPrinterAdapter | null = null;
  private readonly config: PrinterConfig;

  constructor(config: PrinterConfig) {
    this.config = config;
    this.initializeAdapter();
  }

  /**
   * Initialize the appropriate printer adapter based on configuration
   */
  private initializeAdapter(): void {
    if (this.config.interface === 'mock') {
      this.adapter = new MockAdapter(this.config.retryDelayMs);
    } else if (this.config.interface === 'usb') {
      if (!this.config.usbName) {
        throw new Error('USB printer name is required when PRINTER_INTERFACE is "usb"');
      }
      this.adapter = new USBAdapter(this.config.usbName);
    } else if (this.config.interface === 'serial') {
      if (!this.config.serialPort) {
        throw new Error('Serial port is required when PRINTER_INTERFACE is "serial"');
      }
      this.adapter = new SerialAdapter(this.config.serialPort);
    } else {
      throw new Error(`Invalid printer interface: ${this.config.interface}. Must be "usb", "serial", or "mock"`);
    }
  }

  /**
   * Connect to the printer
   */
  async connect(): Promise<void> {
    if (!this.adapter) {
      throw new Error('Printer adapter is not initialized');
    }
    await this.adapter.connect();
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
    }
  }

  /**
   * Print data with retry logic
   * @param data - The receipt data to print
   * @returns Promise that resolves when print is successful
   */
  async print(data: string): Promise<void> {
    if (!this.adapter) {
      throw new Error('Printer adapter is not initialized');
    }

    // Ensure printer is connected
    if (!this.adapter.isConnected()) {
      await this.connect();
    }

    let lastError: Error | null = null;

    // Retry loop
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.adapter.print(data);
        // Success - return immediately
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If this is not the last attempt, wait before retrying
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs);
          
          // Try to reconnect before next attempt
          try {
            await this.disconnect();
            await this.connect();
          } catch (reconnectError) {
            // Log reconnect error but continue with retry
            console.warn(`Failed to reconnect before retry ${attempt + 1}:`, reconnectError);
          }
        }
      }
    }

    // All retries exhausted
    throw new Error(
      `Print failed after ${this.config.maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Check if printer is connected
   */
  isConnected(): boolean {
    return this.adapter?.isConnected() ?? false;
  }

  /**
   * Delay helper for retry mechanism
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

