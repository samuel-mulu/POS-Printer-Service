/**
 * Print request interface
 */
export interface PrintRequest {
  data: string;
  key?: string;
}

/**
 * Print response interface
 */
export interface PrintResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Printer configuration interface
 */
export interface PrinterConfig {
  interface: "usb" | "raw-usb" | "serial" | "mock" | "win-spool-raw";

  usbName?: string;
  usbVid?: number;
  usbPid?: number;

  serialPort?: string;

  // NEW
  windowsPrinterName?: string;
  charset?: string;

  maxRetries: number;
  retryDelayMs: number;

  // If you already have driver in config for USBAdapter, keep it:
  driver?: any;
}

/**
 * Base adapter interface for printer adapters
 */
export interface IPrinterAdapter {
  /**
   * Connect to the printer
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the printer
   */
  disconnect(): Promise<void>;

  /**
   * Check if printer is connected
   */
  isConnected(): boolean;

  /**
   * Print the given data
   * @param data - The receipt data to print
   */
  print(data: string): Promise<void>;
}