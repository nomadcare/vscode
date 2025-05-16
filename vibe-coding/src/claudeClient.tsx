import fetch from "node-fetch"; // убедитесь, что добавили зависимость "node-fetch"
import { Message } from "./projectState";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01"; // версия API (может обновляться)

export class ClaudeClient {
	private apiKey: string | undefined;

	constructor(apiKey: string | undefined) {
		this.apiKey = apiKey;
	}

	/**
	 * Отправить сообщения (историю диалога + новый промпт) в Claude и получить ответ.
	 * @param messages Массив сообщений (история), включая последнее сообщение пользователя.
	 * @param onData Callback, вызываемый при получении каждой части текстового ответа.
	 * @returns Полный ответ ассистента (после завершения стрима).
	 */
	async sendMessageStream(
		messages: Message[],
		onData: (partialText: string) => void
	): Promise<string> {
		if (!this.apiKey) {
			throw new Error(
				"API ключ Claude не задан. Укажите anthropicApiKey в настройках."
			);
		}

		const requestBody: any = {
			model: "claude-3-7-sonnet-20250219",
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			max_tokens: 10000,
			stream: true,
			system:
				"Ты – ассистент, помогающий генерировать Expo (React Native) проект. " +
				"Действуй по запросу пользователя и возвращай код проекта. " +
				"Форматируй ответ в виде Markdown-кода по файлам: для каждого файла начинай новый блок кода с указанием языка " +
				"и на первой строке внутри него комментарием вида '// File: <имя файла>'. " +
				"Заверши каждый файл закрывающим ``` и затем начинай следующий, чтобы каждое файло было отдельным блоком кода. " +
				"Не добавляй лишних пояснений вне этих блоков.",
		};

		const response = await fetch(CLAUDE_API_URL, {
			method: "POST",
			headers: {
				"x-api-key": this.apiKey,
				"anthropic-version": ANTHROPIC_VERSION,
				"content-type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`Ошибка API Claude: ${response.status} - ${errText}`);
		}
		if (!response.body) {
			throw new Error("Пустой поток ответа от Claude.");
		}

		// NodeJS ReadableStream приводим к AsyncIterable<Uint8Array>
		const stream = response.body as unknown as AsyncIterable<Uint8Array>;
		const decoder = new TextDecoder();
		let fullResponse = "";
		let buffer = "";

		for await (const chunk of stream) {
			// Декодируем и аккумулируем в буфер
			buffer += decoder.decode(chunk, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop()!; // последняя, возможно неполная строка

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) continue;

				const dataStr = trimmed.replace(/^data:\s*/, "");
				if (dataStr === "[DONE]") continue;

				let data: any;
				try {
					data = JSON.parse(dataStr);
				} catch (e) {
					console.error("Ошибка парсинга JSON из потока Claude:", e, dataStr);
					continue;
				}

				if (
					data.type === "content_block_delta" &&
					data.delta?.type === "text_delta"
				) {
					const content = data.delta.text;
					if (content) {
						fullResponse += content;
						onData(content);
					}
				}

				// при явном окончании сообщения можно прервать
				if (data.type === "message_stop") {
					return fullResponse;
				}
			}
		}

		return fullResponse;
	}
}
