import * as iconv from "iconv-lite";
import { execFile } from "child_process";
import { promisify } from "util";
import { BaseAdapter } from "./baseAdapter";

const execFileAsync = promisify(execFile);

/**
 * Windows RAW Spool Adapter (WritePrinter via PowerShell Add-Type)
 * - Works with installed printers (even “generic” / port-based)
 * - No node-gyp, no libusb, no extra native deps
 */
export class WindowsRawSpoolAdapter extends BaseAdapter {
  constructor(
    private readonly printerName: string,
    private readonly charset: string = "PC437"
  ) {
    super();
    if (!printerName) throw new Error("PRINTER_WINDOWS_NAME is required");
  }

  async connect(): Promise<void> {
    // Windows spooler handles connection; assume OK if printer exists.
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async print(data: string): Promise<void> {
    this.ensureConnected();

    // Encode text
    const textBuf = iconv.encode(data + "\n", this.charset);

    // ESC/POS: feed + cut (cut may not work on all models; can remove cutCmd)
    const feedCmd = Buffer.from([0x1b, 0x64, 0x03]); // ESC d 3
    const cutCmd = Buffer.from([0x1d, 0x56, 0x01]); // GS V 1 (partial cut)

    const payload = Buffer.concat([textBuf, feedCmd, cutCmd]).toString("base64");

    const ps = `
$printerName = "${this.printerName.replace(/"/g, '""')}"
$base64 = "${payload}"
$bytes = [Convert]::FromBase64String($base64)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFOA di);

  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  public static void SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if(!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new Exception("OpenPrinter failed: " + Marshal.GetLastWin32Error());
    }

    var di = new DOCINFOA();
    di.pDocName = "POS Receipt";
    di.pDataType = "RAW";

    if(!StartDocPrinter(hPrinter, 1, di)) {
      int err = Marshal.GetLastWin32Error();
      ClosePrinter(hPrinter);
      throw new Exception("StartDocPrinter failed: " + err);
    }

    if(!StartPagePrinter(hPrinter)) {
      int err = Marshal.GetLastWin32Error();
      EndDocPrinter(hPrinter);
      ClosePrinter(hPrinter);
      throw new Exception("StartPagePrinter failed: " + err);
    }

    int written;
    if(!WritePrinter(hPrinter, bytes, bytes.Length, out written)) {
      int err = Marshal.GetLastWin32Error();
      EndPagePrinter(hPrinter);
      EndDocPrinter(hPrinter);
      ClosePrinter(hPrinter);
      throw new Exception("WritePrinter failed: " + err);
    }

    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
  }
}
"@

[RawPrinterHelper]::SendBytes($printerName, $bytes)
`;

    try {
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        ps,
      ]);
    } catch (e: any) {
      const stderr = e?.stderr?.toString?.() || "";
      const msg = stderr || e?.message || "Unknown spooler error";
      throw new Error(`Windows RAW print failed: ${msg}`);
    }
  }
}