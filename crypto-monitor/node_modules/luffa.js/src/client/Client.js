import { Rest } from "./Rest.js";
import { Poller } from "./Poller.js";
import { Message } from "../structures/Message.js";

/**
 * Main Luffa client class.
 * Orchestrates polling, message handling, and API interactions.
 */
export class Client {
  constructor(options = {}) {
    if (!options.secret) {
      throw new Error("Luffa Client requires a secret");
    }

    this.secret = options.secret;
    this.pollInterval = options.pollInterval ?? 1000;

    // Initialize components
    this.rest = new Rest(this);
    this.poller = new Poller(this, this.pollInterval);

    // Message handling
    this._messageHandlers = [];
    this._seenMessageIds = new Set();
    
    this._running = false;
  }

  /**
   * Start the client with API validation
   * @throws {Error} If API secret is invalid
   */
  async start() {
    if (this._running) return;

    // Startup validation - test the secret before starting polling
    try {
      await this.rest.receive();
    } catch (err) {
      throw new Error(
        `Luffa Client: ${err.message}. Check your API secret.`
      );
    }

    // Secret is valid - start polling
    this._running = true;
    this.poller.start();
  }

  /**
   * Stop the client and polling
   */
  stop() {
    this._running = false;
    this.poller.stop();
    console.log("Client stopped.");
  }

  /**
   * Register a message handler
   * @param {Function} fn - Callback function receiving normalized messages
   */
  onMessage(fn) {
    if (typeof fn !== "function") {
      throw new Error("onMessage expects a function");
    }
    this._messageHandlers.push(fn);
  }

  /**
   * Internal method to handle received message batches
   * Called by Poller after each successful poll
   * @param {Array} payload - Array of message batch objects
   * @private
   */
  _handleReceive(payload) {
    if (!Array.isArray(payload)) return;

    for (const entry of payload) {
      const channelId = entry.uid;
      const isGroup = entry.type === 1 || entry.type === "1";
      const messages = entry.message;

      if (!Array.isArray(messages)) continue;

      for (const raw of messages) {
        let parsed;

        try {
          // Each message is a JSON string that needs parsing
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        const msgId = parsed.msgId;
        
        // Deduplicate messages (required by Luffa API docs)
        if (!msgId || this._seenMessageIds.has(msgId)) {
          continue;
        }

        this._seenMessageIds.add(msgId);

        // Normalize message structure
        const message = new Message(this, {
          id: msgId,
          content: parsed.text ?? "",
          authorId: parsed.uid ?? channelId,
          channelId,
          isGroup,
          raw: parsed,
        });

        // Emit to all registered handlers
        for (const handler of this._messageHandlers) {
          try {
            handler(message);
          } catch (err) {
            console.error("Message handler error:", err);
          }
        }
      }
    }
  }
}