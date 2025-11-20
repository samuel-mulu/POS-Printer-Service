/**
 * Print Queue Manager
 * Ensures print jobs are processed sequentially, one at a time
 * Prevents race conditions when multiple cashiers print simultaneously
 */
export class PrintQueue {
  private queue: Array<{
    data: string;
    resolve: (value: void) => void;
    reject: (error: Error) => void;
  }> = [];
  private processing: boolean = false;
  private printFunction: (data: string) => Promise<void>;

  constructor(printFunction: (data: string) => Promise<void>) {
    this.printFunction = printFunction;
  }

  /**
   * Add a print job to the queue
   * @param data - The receipt data to print
   * @returns Promise that resolves when the print job is completed
   */
  async enqueue(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Add job to queue
      this.queue.push({ data, resolve, reject });

      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        break;
      }

      try {
        console.log(
          `📋 [QUEUE] Processing print job (${this.queue.length} jobs remaining in queue)`
        );
        await this.printFunction(job.data);
        job.resolve();
        console.log(`✅ [QUEUE] Print job completed`);
      } catch (error) {
        console.error(`❌ [QUEUE] Print job failed:`, error);
        job.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.processing = false;

    // If more jobs were added while processing, continue
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Get the current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if a job is currently being processed
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Clear all pending jobs from the queue
   */
  clear(): void {
    const jobs = this.queue.splice(0);
    jobs.forEach((job) => {
      job.reject(new Error("Print queue was cleared"));
    });
  }
}
