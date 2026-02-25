import { PrinterTypes, ThermalPrinter } from "node-thermal-printer";
import { BaseAdapter } from "./baseAdapter";

/**
 * USB printer adapter using node-thermal-printer
 *
 * Windows note:
 * node-thermal-printer expects Windows spooler printers using:
 *   interface: "printer:PRINTER_NAME"
 */
export class USBAdapter extends BaseAdapter {
  private printer: ThermalPrinter | null = null;
  private readonly printerName: string;
  private readonly driver?: any;

  constructor(printerName: string, driver?: any) {
    super();
    if (!printerName) {
      throw new Error("USB printer name is required");
    }

    // ✅ KISS: normalize Windows interface string
    // Accept both "POSnew" and "printer:POSnew"
    this.printerName = printerName.startsWith("printer:")
      ? printerName
      : `printer:${printerName}`;
    this.driver = driver;
  }

  /**
   * Connect to the USB printer
   */
async connect(): Promise<void> {
  try {
    this.printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: this.printerName,
      options: { timeout: 5000 },
    });

    // ✅ KISS: Windows drivers may report "not connected" even if printing works.
    // Don't block startup. Real failures will show during print().
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
      this.printer.clear();
      this.printer.println(data);
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