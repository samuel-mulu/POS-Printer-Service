import { CharacterSet, PrinterTypes, ThermalPrinter } from "node-thermal-printer";
import { BaseAdapter } from "./baseAdapter";

/**
 * Windows Adapter - Prints via Windows Spooler (Installed Printers)
 */
export class WindowsAdapter extends BaseAdapter {
  private printer: ThermalPrinter | null = null;
  private readonly fullInterfaceName: string;
  private readonly characterSet: CharacterSet;

  constructor(printerName: string, characterSet?: string) {
    super();
    if (!printerName) {
      throw new Error("Windows printer name is required for 'windows' interface");
    }

    // Ensure the interface starts with "printer:" for node-thermal-printer to use Windows Spooler
    this.fullInterfaceName = printerName.startsWith("printer:")
      ? printerName
      : `printer:${printerName}`;

    // Map character set or default to PC437_USA to avoid encoding crashes
    this.characterSet = (characterSet as CharacterSet) || CharacterSet.PC437_USA;
  }

  /**
   * Connect to the Windows printer
   */
  async connect(): Promise<void> {
    try {
      this.printer = new ThermalPrinter({
        type: PrinterTypes.EPSON, // Most Windows POS printers are Epson-compatible
        interface: this.fullInterfaceName,
        characterSet: this.characterSet,
        options: { timeout: 5000 },
      });

      // Verification of connectivity is handled by the OS spooler, 
      // so we mark as connected now and catch errors during print.
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(
        `Failed to initialize Windows printer "${this.fullInterfaceName}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.printer = null;
  }

  /**
   * Print data
   */
  async print(data: string): Promise<void> {
    this.ensureConnected();

    if (!this.printer) {
      throw new Error("Printer instance is not available");
    }

    try {
      this.printer.clear();
      this.printer.println(data);
      const result = await this.printer.execute();
      
      if (!result) {
        throw new Error("Print execution returned no result");
      }
    } catch (error) {
      throw new Error(
        `Windows printing failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
