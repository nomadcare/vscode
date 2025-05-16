// File: claudeClient.ts
import fetch from "node-fetch";
import { Message } from "./projectState";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Системный промпт для Claude
const SYSTEM_PROMPT = [
	"Ты — ассистент по генерации проектов Expo (React Native).",
	"При запросе типа “Create expo app” сгенерируй полный исходный код всех файлов и папок, которые создаёт стандартный шаблон create-expo-app (managed workflow):",
	"- package.json",
	"- app.json",
	"- babel.config.js",
	"- metro.config.js (с watcher.enablePolling: true, interval: 1000 и разрешением импорта `punycode` через extraNodeModules)",
	"- Установить и прописать в зависимостях `punycode` (npm install punycode)",
	"- .gitignore",
	"- App.js",
	"- README.md",
	"- папку assets с placeholder-заглушками icon.png и splash.png",
	"Если пользователь в своём запросе указывает дополнительные файлы или папки — добавь их тоже.",
	"",
	"Возвращай **только** Markdown-блоки, без лишнего текста. Формат:",
	"1) Для обычного файла:",
	"```<язык>           ← javascript, json, text и т.д.",
	"// File: <имя_файла>  ← обязательно с расширением",
	"<полный контент файла>",
	"```",
	"2) Для папки:",
	"```text",
	"// Folder: <имя_папки>",
	"```",
	"3) Для ассетов:",
	"```text",
	"// File: assets/icon.png",
	"Placeholder for image file icon.png",
	"```",
	"",
	"После всех файлов обязательно добавь последний блок с командами установки и запуска проекта:",
	"```shell",
	"npm install punycode && npm install && npx expo start",
	"```",
	"Никаких дополнительных пояснений вне этих блоков.",
].join(" ");

export class ClaudeClient {
	private apiKey: string | undefined;

	constructor(apiKey: string | undefined) {
		this.apiKey = apiKey;
	}

	async sendMessageStream(
		messages: Message[],
		onData: (partialText: string) => void
	): Promise<string> {
		if (!this.apiKey) {
			throw new Error(
				"API ключ Claude не задан. Укажите anthropicApiKey в настройках."
			);
		}

		const requestBody = {
			model: "claude-3-7-sonnet-20250219",
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			max_tokens: 10000,
			stream: true,
			system: SYSTEM_PROMPT,
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

		const stream = response.body as unknown as AsyncIterable<Uint8Array>;
		const decoder = new TextDecoder();
		let fullResponse = "";
		let buffer = "";

		for await (const chunk of stream) {
			buffer += decoder.decode(chunk, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop()!;

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

				if (data.type === "message_stop") {
					return fullResponse;
				}
			}
		}

		return fullResponse;
	}
}
