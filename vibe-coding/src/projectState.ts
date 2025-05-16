export interface Message {
	role: "user" | "assistant";
	content: string;
}

export class ProjectState {
	// История диалога с Claude
	private conversation: Message[] = [];

	// Добавить сообщение пользователя в историю
	addUserMessage(content: string) {
		this.conversation.push({ role: "user", content });
	}

	// Добавить сообщение ассистента (Claude) в историю
	addAssistantMessage(content: string) {
		this.conversation.push({ role: "assistant", content });
	}

	// Получить всю историю сообщений (для нового запроса к модели)
	getConversation(): Message[] {
		return this.conversation;
	}

	// Очистить историю (например, для новой сессии/проекта)
	reset() {
		this.conversation = [];
	}
}
