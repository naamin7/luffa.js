/**
 * Manages the polling loop for receiving messages from Luffa API.
 * Uses setTimeout instead of setInterval to prevent overlapping requests.
 */
export class Poller {
  constructor(client, interval = 1000) {
    this.client = client;
    this.interval = interval;
    this.running = false;
    this.timer = null;
  }

  /**
   * Start the polling loop
   */
  start() {
    if (this.running) return;
    this.running = true;
    this._tick();
  }

  /**
   * Stop the polling loop
   */
  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Internal tick function - executes one poll cycle
   * @private
   */
  async _tick() {
    if (!this.running) return;

    try {
      const data = await this.client.rest.receive();
      
      // Let Client handle the received data
      if (this.client._handleReceive) {
        this.client._handleReceive(data);
      }
    } catch (err) {
      // Don't crash the loop on errors
      console.error("Polling error:", err.message);
    }

    // Schedule next tick (prevents overlapping requests)
    this.timer = setTimeout(() => this._tick(), this.interval);
  }
}
