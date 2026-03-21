export class LuffaAPIError extends Error {
	constructor(message = "Luffa API error", details) {
		super(message);
		this.name = "LuffaAPIError";
		this.details = details;
	}
}
