import { ThermalPrinter, PrinterTypes } from "node-thermal-printer";
import { BaseAdapter } from "./baseAdapter";

/**
 * USB printer adapter using node-thermal-printer
 */
export class USBAdapter extends BaseAdapter {
  private printer: ThermalPrinter | null = null;
  private readonly printerName: string;

  constructor(printerName: string) {
    super();
    if (!printerName) {
      throw new Error("USB printer name is required");
    }
    this.printerName = printerName;
  }

  /**
   * Connect to the USB printer
   */
  async connect(): Promise<void> {
    try {
      this.printer = new ThermalPrinter({
        type: PrinterTypes.EPSON, // Default to EPSON, can be made configurable
        interface: this.printerName,
        options: {
          timeout: 5000,
        },
      });

      const isConnected = await this.printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error(`USB printer "${this.printerName}" is not connected`);
      }

      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(
        `Failed to connect to USB printer "${this.printerName}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Disconnect from the USB printer
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.printer = null;
  }

  /**
   * Print the given data
   * @param data - The receipt data to print
   */
  async print(data: string): Promise<void> {
    this.ensureConnected();

    if (!this.printer) {
      throw new Error("Printer instance is not available");
    }

    try {
      // Clear any previous print commands
      this.printer.clear();

      // Add the receipt data
      this.printer.println(data);

      // Execute the print job
      await this.printer.execute();
    } catch (error) {
      throw new Error(
        `Failed to print: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
