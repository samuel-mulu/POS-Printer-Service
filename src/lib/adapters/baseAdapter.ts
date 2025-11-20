import { IPrinterAdapter } from "../../types";

/**
 * Base abstract class for printer adapters
 * Provides common structure and error handling
 */
export abstract class BaseAdapter implements IPrinterAdapter {
  protected connected: boolean = false;

  /**
   * Connect to the printer
   * Must be implemented by subclasses
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the printer
   * Must be implemented by subclasses
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if printer is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Print the given data
   * Must be implemented by subclasses
   * @param data - The receipt data to print
   */
  abstract print(data: string): Promise<void>;

  /**
   * Validate that printer is connected before operation
   * @throws Error if printer is not connected
   */
  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error("Printer is not connected");
    }
  }
}
