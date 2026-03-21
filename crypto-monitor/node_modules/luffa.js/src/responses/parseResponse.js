/**
 * Parses Luffa API responses which use a "soft-fail" approach.
 * All HTTP requests return 200, but errors are in the response body.
 * 
 * @param {Object} body - The JSON response body
 * @returns {*} The response data if successful
 * @throws {Error} If the response indicates failure
 */
import { SoftFailError } from "../errors/SoftFailError.js";

export function parseResponse(body) {
  // Check for soft-fail error responses
  if (body?.msg === "Robot verification failed" || body?.code === 500) {
    throw new SoftFailError(body.msg || "API request failed", body.code);
  }

  // For successful responses, return the body as-is
  // (Luffa doesn't wrap data in a .data field for /receive endpoint)
  return body;
}
