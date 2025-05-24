// File: claudeClient.ts

import fetch from "node-fetch";
import { Message } from "./projectState";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const MODEL_TOKEN_LIMITS: Record<string, number> = {
	"claude-3-5-haiku-20241022": 8192,
	"claude-3-7-sonnet-20250219": 10000,
};

/**
 * Оригинальный SYSTEM_PROMPT — полная версия:
 */
const SYSTEM_PROMPT = [
	"Ты — ассистент по генерации проектов Expo (React Native).",
	"",
	"При запросе типа “Create expo app” сгенерируй полный исходный код всех файлов и папок, которые создаёт стандартный шаблон create-expo-app (managed workflow):",
	"- package.json",
	"- app.json",
	"- babel.config.js",
	"- metro.config.js (c watcher.enablePolling: true, interval: 1000 и разрешением импорта `punycode` через extraNodeModules)",
	"- Установить и прописать в зависимостях `punycode` (npm install punycode)",
	"- .gitignore",
	"- App.js",
	"- README.md",
	"- Папку assets с placeholder-заглушками icon.png и splash.png",
	"Если пользователь указывает дополнительные файлы или папки — добавь их тоже.",
	"",
	"⚠️ **ВАЖНО**: формат каждого блока кода _обязателен_. Открывающая тройная кавычка с указанием языка ДОЛЖНА быть на отдельной строке.",
	"Затем перевод строки и строка `// File: <имя_файла>` (или `// Folder: <имя_папки>`).",
	"Никогда не ставь `// File:` на той же строке, что и ```. ",
	"",
	"Пример правильного файла:",
	"```javascript",
	"// File: package.json",
	"{",
	'  "name": "my-app"',
	"}",
	"```",
	"",
	"Пример правильной папки:",
	"```text",
	"// Folder: src",
	"```",
	"",
	"После всех файлов добавь последний блок с командами запуска:",
	"```shell",
	"npm install punycode && npm install && npx expo start",
	"```",
	"",
	"Никаких пояснений вне этих Markdown-блоков.",
	"🔄 **Если пользователь позже просит изменить проект, генерируй ТОЛЬКО",
	"те файлы, которые реально изменились или новые; не пересоздавай то,",
	"что уже существует без изменений.**",
].join("\n");

export class ClaudeClient {
	private apiKey?: string;

	constructor(apiKey?: string) {
		this.apiKey = apiKey;
	}

	async sendMessageStream(
		messages: Message[],
		model: string,
		onData: (partialText: string) => void,
		systemPromptOverride?: string
	): Promise<string> {
		if (!this.apiKey) {
			throw new Error("API ключ Claude не задан.");
		}

		const maxTokens = MODEL_TOKEN_LIMITS[model] ?? 8192;
		const prompt = systemPromptOverride ?? SYSTEM_PROMPT;

		const payload = {
			model,
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			max_tokens: maxTokens,
			system: prompt,
			stream: true,
		};

		const resp = await fetch(CLAUDE_API_URL, {
			method: "POST",
			headers: {
				"x-api-key": this.apiKey,
				"anthropic-version": ANTHROPIC_VERSION,
				"content-type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(`Claude API error ${resp.status}: ${text}`);
		}
		if (!resp.body) {
			throw new Error("Пустой поток ответа от Claude.");
		}

		const decoder = new TextDecoder();
		let buffer = "";
		let full = "";

		for await (const chunk of resp.body as unknown as AsyncIterable<Uint8Array>) {
			buffer += decoder.decode(chunk, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop()!;

			for (const line of lines) {
				if (!line.trim().startsWith("data:")) continue;
				const dataStr = line.replace(/^data:\s*/, "");
				if (dataStr === "[DONE]") continue;
				try {
					const data = JSON.parse(dataStr);
					if (
						data.type === "content_block_delta" &&
						data.delta?.type === "text_delta" &&
						data.delta.text
					) {
						const txt = data.delta.text;
						full += txt;
						onData(txt);
					}
					if (data.type === "message_stop") {
						return full;
					}
				} catch {
					// ignore parse errors
				}
			}
		}
		return full;
	}
}
