import { SerialPortStream } from "@serialport/stream";
import {
  WindowsBinding,
  WindowsBindingInterface,
} from "@serialport/bindings-cpp";
import { BaseAdapter } from "./baseAdapter";

/**
 * Serial/Bluetooth printer adapter using @serialport/stream
 */
export class SerialAdapter extends BaseAdapter {
  private port: SerialPortStream<WindowsBindingInterface> | null = null;
  private readonly comPort: string;
  private readonly baudRate: number = 9600; // Default baud rate for thermal printers

  constructor(comPort: string, baudRate?: number) {
    super();
    if (!comPort) {
      throw new Error("COM port is required");
    }
    this.comPort = comPort;
    if (baudRate) {
      this.baudRate = baudRate;
    }
  }

  /**
   * Connect to the serial printer
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.port = new SerialPortStream({
          binding: WindowsBinding,
          path: this.comPort,
          baudRate: this.baudRate,
          autoOpen: false,
        });

        this.port.open((error: Error | null) => {
          if (error) {
            this.connected = false;
            reject(
              new Error(
                `Failed to open serial port "${this.comPort}": ${error.message}`
              )
            );
            return;
          }

          this.connected = true;
          resolve();
        });
      } catch (error) {
        this.connected = false;
        reject(
          new Error(
            `Failed to create serial port connection: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        );
      }
    });
  }

  /**
   * Disconnect from the serial printer
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port) {
        this.connected = false;
        resolve();
        return;
      }

      if (!this.port.isOpen) {
        this.connected = false;
        this.port = null;
        resolve();
        return;
      }

      this.port.close((error: Error | null) => {
        this.connected = false;
        this.port = null;
        if (error) {
          reject(new Error(`Failed to close serial port: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Print the given data
   * @param data - The receipt data to print
   */
  async print(data: string): Promise<void> {
    this.ensureConnected();

    if (!this.port || !this.port.isOpen) {
      throw new Error("Serial port is not open");
    }

    return new Promise((resolve, reject) => {
      // ESC/POS commands for thermal printers
      // Initialize printer
      const initCommand = Buffer.from([0x1b, 0x40]); // ESC @

      // Convert text to buffer with proper encoding
      const textBuffer = Buffer.from(data, "utf8");

      // Cut paper command (optional, can be removed if not needed)
      const cutCommand = Buffer.from([0x1d, 0x56, 0x41, 0x00]); // GS V A 0

      // Combine all commands
      const printBuffer = Buffer.concat([
        initCommand,
        textBuffer,
        Buffer.from("\n\n", "utf8"),
        cutCommand,
      ]);

      this.port!.write(printBuffer, (error: Error | null | undefined) => {
        if (error) {
          reject(new Error(`Failed to write to serial port: ${error.message}`));
          return;
        }

        // Wait for data to be drained
        this.port!.drain((drainError: Error | null) => {
          if (drainError) {
            reject(
              new Error(`Failed to drain serial port: ${drainError.message}`)
            );
          } else {
            resolve();
          }
        });
      });
    });
  }
}
