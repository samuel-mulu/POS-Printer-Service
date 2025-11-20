import { BaseAdapter } from "./baseAdapter";

/**
 * Mock printer adapter for development/testing
 * Simulates printing by logging to console
 */
export class MockAdapter extends BaseAdapter {
  private readonly delayMs: number;

  constructor(delayMs: number = 500) {
    super();
    this.delayMs = delayMs;
  }

  /**
   * Connect to the mock printer (always succeeds)
   */
  async connect(): Promise<void> {
    console.log("🔌 [MOCK] Connecting to mock printer...");
    // Simulate connection delay
    await this.delay(this.delayMs);
    this.connected = true;
    console.log("✅ [MOCK] Mock printer connected successfully");
  }

  /**
   * Disconnect from the mock printer
   */
  async disconnect(): Promise<void> {
    console.log("🔌 [MOCK] Disconnecting from mock printer...");
    this.connected = false;
    console.log("✅ [MOCK] Mock printer disconnected");
  }

  /**
   * Print the given data (mocked - logs to console)
   * @param data - The receipt data to print
   */
  async print(data: string): Promise<void> {
    this.ensureConnected();

    console.log("\n" + "=".repeat(50));
    console.log("🖨️  [MOCK PRINT] Receipt Data:");
    console.log("=".repeat(50));
    console.log(data);
    console.log("=".repeat(50));
    console.log("✅ [MOCK] Print job completed successfully\n");

    // Simulate print delay
    await this.delay(this.delayMs);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

