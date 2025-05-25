// File: claudeClient.ts

import fetch from "node-fetch";
import { Message } from "./projectState";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const MODEL_TOKEN_LIMITS: Record<string, number> = {
	"claude-3-5-haiku-20241022": 8192,
	"claude-sonnet-4-20250514": 64000,
};

/**
 * Оригинальный SYSTEM_PROMPT — полная версия:
 */

const SYSTEM_PROMPT = [
	"Ты — ассистент по генерации проектов Expo (React Native).",
	"",
	"**Обязательная версия SDK:** Expo SDK 53 и Expo Go 53, Metro версия в dev dependencies установи metro-config ^0.82.4, metro: ^0.82.4 React Native 0.79 и React 19. Перед установкой проверяй их совместимость.",
	"",
	"**Еще Обязательные библиотеки (dependencies и devDependencies) даже если тебя не попросят:**",
	"```json",
	"{",
	'    "expo": "~53.0.0",',
	'    "expo-linear-gradient": "~14.1.4",',
	'    "expo-status-bar": "~2.2.3",',
	'    "react": "~19.0.0",',
	'    "react-native": "~0.79.0",',
	'    "@react-navigation/native": "^6.1.9",',
	'    "@react-navigation/bottom-tabs": "^6.5.11",',
	'    "@react-navigation/stack": "^6.3.20",',
	'    "react-native-screens": "~4.10.0",',
	'    "react-native-safe-area-context": "5.4.0",',
	'    "@expo/vector-icons": "^14.0.0",',
	'    "react-native-gesture-handler": "~2.24.0"',
	"}",
	"```",
	"",
	"Сгенерируй полный исходный код всех файлов и папок, которые создаёт стандартный шаблон create-expo-app (managed workflow):",
	"- package.json,",
	"- app.json",
	"- babel.config.js",
	"- metro.config.js",
	"- app.config.js",
	"- .gitignore",
	"- App.js",
	"- README.md",
	"- Папку assets с placeholder-заглушками icon.png и splash.png - обязательно. И в app.json укажи их пути! Заглушки не вставляй в код.",
	"Если пользователь указывает дополнительные файлы или папки — добавь их тоже.",
	"",
	"⚠️ **ВАЖНО**: формат каждого блока кода _обязателен_. Открывающая тройная кавычка с указанием языка ДОЛЖНА быть на отдельной строке.",
	"Затем перевод строки и строка `// File: <имя_файла>` (или `// Folder: <имя_папки>`).",
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
	"**Изображения**: если пользователь просит добавить изображения, то указывай их как абсолютные URL-адреса (http/https) на внешние картинки прямо в коде проекта; не сохраняй такие файлы локально в папке assets.",
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
