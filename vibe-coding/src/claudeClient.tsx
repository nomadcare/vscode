// File: claudeClient.ts
import fetch from "node-fetch";
import { Message } from "./projectState";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const MODEL_TOKEN_LIMITS: Record<string, number> = {
	"claude-3-5-haiku-20241022": 8192, // лимит токенов для Haiku
	"claude-3-7-sonnet-20250219": 10000, // лимит токенов для Sonnet
};

/**
 * СИСТЕМНЫЙ ПРОМПТ
 *
 * Логику и перечень файлов оставили прежними, но добавили строгое требование:
 * 1. Открывающая тройная кавычка с указанием языка ДОЛЖНА быть на отдельной строке.
 * 2. Сразу после неё — перевод строки и строка `// File: <имя_файла>`.
 * 3. Запрещено писать `// File:` на той же строке, что и ```.
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
	"⚠️ **ВАЖНО**: формат каждого блока кода _обязателен_. Открывающая строка с ```<язык> стоит ОТДЕЛЬНО,",
	"затем перевод строки, затем **на новой строке** `// File: <имя_файла>` (или `// Folder:`).",
	"Никогда не ставь `// File:` на той же строке, что и ```.",
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
].join(" ");

export class ClaudeClient {
	private apiKey?: string;

	constructor(apiKey?: string) {
		this.apiKey = apiKey;
	}

	async sendMessageStream(
		messages: Message[],
		model: string,
		onData: (partialText: string) => void
	): Promise<string> {
		if (!this.apiKey) {
			throw new Error("API ключ Claude не задан.");
		}

		const maxTokens = MODEL_TOKEN_LIMITS[model] ?? 8192;

		const payload = {
			model,
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			max_tokens: maxTokens,
			system: SYSTEM_PROMPT,
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
			const errText = await resp.text();
			throw new Error(`Ошибка API Claude: ${resp.status} – ${errText}`);
		}
		if (!resp.body) {
			throw new Error("Пустой поток ответа от Claude.");
		}

		// === Чтение стрима ===
		const stream = resp.body as unknown as AsyncIterable<Uint8Array>;
		const decoder = new TextDecoder();
		let buf = "";
		let full = "";

		for await (const chunk of stream) {
			buf += decoder.decode(chunk, { stream: true });
			const lines = buf.split("\n");
			buf = lines.pop()!;

			for (const line of lines) {
				const t = line.trim();
				if (!t.startsWith("data:")) continue;
				const payload = t.replace(/^data:\s*/, "");
				if (payload === "[DONE]") continue;

				try {
					const data = JSON.parse(payload);
					if (
						data.type === "content_block_delta" &&
						data.delta?.type === "text_delta"
					) {
						const text = data.delta.text;
						if (text) {
							full += text;
							onData(text);
						}
					}
					if (data.type === "message_stop") {
						return full;
					}
				} catch (e) {
					console.error("Error parse JSON:", e, payload);
				}
			}
		}

		return full;
	}
}
