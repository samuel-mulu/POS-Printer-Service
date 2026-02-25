import * as iconv from "iconv-lite";
import * as usb from "usb";
import { BaseAdapter } from "./baseAdapter";

/**
 * Raw USB adapter using node-usb for direct communication (Driverless)
 */
export class RawUsbAdapter extends BaseAdapter {
  private device: usb.Device | null = null;
  private endpoint: usb.OutEndpoint | null = null;
  private interface: usb.Interface | null = null;

  constructor(
    private readonly vid?: number,
    private readonly pid?: number,
    private readonly usbName?: string,
    private readonly charset: string = "pc437"
  ) {
    super();
  }

  async connect(): Promise<void> {
    try {
      if (this.vid && this.pid) {
        this.device = usb.findByIds(this.vid, this.pid) || null;
        if (!this.device) {
          throw new Error(
            `USB device not found for VID: 0x${this.vid.toString(
              16
            )}, PID: 0x${this.pid.toString(16)}`
          );
        }
      } else if (this.usbName) {
        // Fallback: search by name
        const devices = usb.getDeviceList();
        for (const dev of devices) {
          try {
            dev.open();
            // This is a bit heavy but needed to read strings
            const product = await new Promise<string | undefined>((resolve) => {
              dev.getStringDescriptor(
                dev.deviceDescriptor.iProduct,
                (err, str) => resolve(str)
              );
            });
            dev.close();

            if (
              product &&
              product.toLowerCase().includes(this.usbName.toLowerCase())
            ) {
              this.device = dev;
              break;
            }
          } catch (e) {
            // Some devices might fail to open or read descriptor
            continue;
          }
        }

        if (!this.device) {
          throw new Error(`USB device not found with name: ${this.usbName}`);
        }
      } else {
        throw new Error("USB device VID/PID or name is required for raw-usb");
      }

      const device = this.device;
      if (!device) {
        throw new Error("No USB device selected");
      }

      device.open();

      if (!device.interfaces) {
        throw new Error("USB device has no interfaces");
      }

      // Find interface and OUT endpoint
      for (const iface of device.interfaces) {
        const ep = iface.endpoints.find((e) => e.direction === "out");
        if (ep && ep instanceof usb.OutEndpoint) {
          this.interface = iface;
          this.endpoint = ep;
          break;
        }
      }

      if (!this.interface || !this.endpoint) {
        throw new Error("No OUT endpoint found on USB device");
      }

      // Detach kernel driver if necessary (Windows usually doesn't need this or fails it)
      try {
        if (this.interface.isKernelDriverActive()) {
          this.interface.detachKernelDriver();
        }
      } catch (e) {
        // Ignore errors on Windows
      }

      this.interface.claim();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.interface) {
      try {
        this.interface.release(true, () => {
          if (this.device) {
            try {
              this.device.close();
            } catch (e) {}
          }
        });
      } catch (e) {
        if (this.device) {
          try {
            this.device.close();
          } catch (e2) {}
        }
      }
    }
    this.interface = null;
    this.endpoint = null;
    this.device = null;
    this.connected = false;
  }

  async print(data: string): Promise<void> {
    this.ensureConnected();
    if (!this.endpoint) {
      throw new Error("No OUT endpoint available");
    }

    try {
      const charset = this.charset || "pc437";
      // Convert text to buffer using iconv
      const textBuf = iconv.encode(data + "\n", charset);

      // ESC/POS commands:
      const feedCmd = Buffer.from([0x1b, 0x64, 0x03]); // Feed 3 lines
      const cutCmd = Buffer.from([0x1d, 0x56, 0x01]); // Partial cut

      const finalBuf = Buffer.concat([textBuf, feedCmd, cutCmd]);

      await new Promise<void>((resolve, reject) => {
        this.endpoint!.transfer(finalBuf, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      throw new Error(
        `Raw USB print failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
