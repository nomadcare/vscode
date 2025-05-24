// File: projectState.ts
export interface Message {
	role: "user" | "assistant";
	content: string;
}

export class ProjectState {
	private messages: Message[] = [];

	addUserMessage(text: string) {
		this.messages.push({ role: "user", content: text });
	}

	addAssistantMessage(text: string) {
		this.messages.push({ role: "assistant", content: text });
	}

	getConversation() {
		return this.messages;
	}

	reset() {
		this.messages = [];
	}
}
