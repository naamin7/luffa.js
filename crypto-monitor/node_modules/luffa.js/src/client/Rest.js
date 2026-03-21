import { parseResponse } from "../responses/parseResponse.js";
import { LuffaAPIError } from "../errors/LuffaAPIError.js";

/**
 * Handles all HTTP requests to the Luffa API.
 * Centralizes request logic and soft-fail response handling.
 */
export class Rest {
  constructor(client) {
    this.client = client;
    this.baseURL = "https://apibot.luffa.im";
  }

  /**
   * Make a request to the Luffa API
   * @param {string} endpoint - API endpoint (e.g., "/robot/receive")
   * @param {Object} payload - Request body
   * @returns {Promise<*>} Parsed response data
   */
  async request(endpoint, payload = {}) {
    const res = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();

    if (!raw) {
      return parseResponse({});
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      throw new LuffaAPIError("Invalid JSON response from Luffa API", {
        cause: err,
        raw,
        endpoint,
      });
    }

    return parseResponse(body);
  }

  /**
   * Poll for new messages
   * @returns {Promise<Array>} Array of message batches
   */
  async receive() {
    return this.request("/robot/receive", {
      secret: this.client.secret,
    });
  }

  /**
   * Send a private message to a user
   * @param {string} uid - User ID
   * @param {string} text - Message text
   * @returns {Promise<*>}
   */
  async send(uid, text) {
    return this.request("/robot/send", {
      secret: this.client.secret,
      uid,
      msg: JSON.stringify({ text }),
    });
  }

  /**
   * Send a message to a group
   * @param {string} uid - Group ID
   * @param {Object} message - Message object
   * @param {number} type - Message type (1 = text, 2 = buttons)
   * @returns {Promise<*>}
   */
  async sendGroup(uid, message, type = 1) {
    return this.request("/robot/sendGroup", {
      secret: this.client.secret,
      uid,
      msg: JSON.stringify(message),
      type: type.toString(),
    });
  }
}
