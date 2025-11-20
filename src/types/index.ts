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
  interface: "usb" | "serial" | "mock";
  usbName?: string;
  serialPort?: string;
  maxRetries: number;
  retryDelayMs: number;
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
