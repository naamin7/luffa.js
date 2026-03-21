export class Message {
	constructor(client, data) {
		this.client = client;
		this.id = data.id;
		this.content = data.content;
		this.authorId = data.authorId;
		this.channelId = data.channelId;
		this.isGroup = data.isGroup;
		this.raw = data.raw;
	}

	async reply(textOrOptions) {
		if (typeof textOrOptions === "string") {
			return this.#replyWithText(textOrOptions);
		}

		if (!textOrOptions || typeof textOrOptions !== "object") {
			throw new Error("Message.reply expects a string or options object");
		}

		const { text, buttons, confirm, dismissType, mentions } = textOrOptions;

		if (typeof text !== "string" || text.length === 0) {
			throw new Error("Message.reply options must include a non-empty text");
		}

		if (!this.isGroup) {
			return this.client.rest.send(this.channelId, text);
		}

		const payload = { text };
		let type = 1;

		if (buttons || confirm) {
			if (buttons && confirm) {
				throw new Error("Only one of buttons or confirm can be provided");
			}

			type = 2;

			if (buttons) {
				payload.button = normalizeButtons(buttons, false);
			} else {
				payload.confirm = normalizeButtons(confirm, true);
			}

			if (dismissType) {
				payload.dismissType = dismissType;
			}
		}

		if (mentions && Array.isArray(mentions) && mentions.length > 0) {
			const mentionResult = applyMentions(payload.text, mentions);
			payload.text = mentionResult.text;
			payload.atList = mentionResult.atList;
		}

		return this.client.rest.sendGroup(this.channelId, payload, type);
	}

	async #replyWithText(text) {
		if (typeof text !== "string" || text.length === 0) {
			throw new Error("Message.reply expects a non-empty string");
		}

		if (this.isGroup) {
			return this.client.rest.sendGroup(this.channelId, { text }, 1);
		}

		return this.client.rest.send(this.channelId, text);
	}
}

function normalizeButtons(buttons, includeType) {
	if (!Array.isArray(buttons) || buttons.length === 0) {
		throw new Error("Buttons must be a non-empty array");
	}

	return buttons.map((button) => {
		if (!button || typeof button !== "object") {
			throw new Error("Each button must be an object");
		}

		const name = button.name ?? button.label;
		const selector = button.selector ?? button.value;

		if (!name || !selector) {
			throw new Error("Buttons require name/label and selector/value");
		}

		const isHidden = toHiddenFlag(button.isHidden ?? button.hidden);
		const mapped = {
			name,
			selector,
			isHidden,
		};

		if (includeType) {
			mapped.type = button.type ?? button.style ?? "default";
		}

		return mapped;
	});
}

function applyMentions(text, mentions) {
	const safeMentions = mentions
		.filter((mention) => mention && (mention.uid || mention.id))
		.map((mention) => ({
			uid: mention.uid ?? mention.id,
			name: mention.name ?? mention.uid ?? mention.id,
		}));

	const tokens = safeMentions.map((mention) => `@${mention.uid}`);
	const allPresent = tokens.every((token) => text.includes(token));

	let workingText = text;

	if (!allPresent) {
		const prefix = tokens.map((token) => `${token} `).join("");
		workingText = `${prefix}${text}`;
	}

	const atList = [];
	let searchFrom = 0;

	for (let i = 0; i < safeMentions.length; i += 1) {
		const mention = safeMentions[i];
		const token = `@${mention.uid}`;
		const location = workingText.indexOf(token, searchFrom);

		if (location === -1) {
			continue;
		}

		const length = token.length + 1;

		atList.push({
			name: mention.name,
			did: mention.uid,
			length,
			location,
			userType: "0",
		});

		searchFrom = location + token.length;
	}

	return { text: workingText, atList };
}

function toHiddenFlag(value) {
	if (value === true || value === "1" || value === 1) {
		return "1";
	}
	return "0";
}
