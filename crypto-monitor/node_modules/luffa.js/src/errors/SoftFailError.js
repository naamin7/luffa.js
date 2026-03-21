export class SoftFailError extends Error {
  constructor(message = "API request failed", code) {
    super(message);
    this.name = "SoftFailError";
    this.code = code;
  }
}