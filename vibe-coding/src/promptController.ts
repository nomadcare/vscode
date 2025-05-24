// File: src/promptController.ts
import * as vscode from "vscode";
import { ProjectState } from "./projectState";
import { ClaudeClient } from "./claudeClient";
import { FileWriter } from "./fileWriter";
import { ProjectSnapshot } from "./projectSnapshot";

export class PromptController {
	private projectState: ProjectState;
	private claudeClient: ClaudeClient;
	private fileWriter: FileWriter;
	private view: vscode.WebviewView;
	private buffer = "";
	private snapshot: ProjectSnapshot;

	constructor(
		projectState: ProjectState,
		claudeClient: ClaudeClient,
		fileWriter: FileWriter,
		view: vscode.WebviewView
	) {
		this.projectState = projectState;
		this.claudeClient = claudeClient;
		this.fileWriter = fileWriter;
		this.view = view;

		const root =
			vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? process.cwd();
		this.snapshot = new ProjectSnapshot(root);
	}

	/**
	 * Обрабатывает ввод пользователя и стримит ответ Claude
	 */
	async handlePrompt(prompt: string, model: string): Promise<void> {
		// 1. фиксируем запрос
		this.projectState.addUserMessage(prompt);

		// 2. статус в UI
		this.view.webview.postMessage({ type: "status", message: "Processing…" });
		this.view.show?.(true);

		// 3. первый ли запрос?
		const isFirst = this.projectState.getConversation().length === 1;

		// 4. формируем systemOverride
		let systemOverride: string | undefined;
		if (!isFirst) {
			const projectCode = await this.snapshot.collect();
			systemOverride = [
				"Ты — ассистент по генерации проектов Expo (React Native).",
				"Ниже полный код текущего проекта. Меняй ТОЛЬКО те файлы, которые действительно изменяются; не пересоздавай без необходимости.",
				"",
				"Текущий проект:",
				projectCode,
			].join("\n");
		}

		// 5. формируем messages
		const messages = isFirst
			? this.projectState.getConversation()
			: [{ role: "user" as const, content: prompt }];

		try {
			// 6. стримим
			const full = await this.claudeClient.sendMessageStream(
				messages,
				model,
				(chunk) => this.processStreamedText(chunk),
				systemOverride
			);

			// 7. сохраняем полный ответ
			this.projectState.addAssistantMessage(full);

			// 8. сообщаем о завершении (Expo не стартуем!)
			this.view.webview.postMessage({
				type: "done",
				message: "Done.",
			});
		} catch (error: any) {
			this.view.webview.postMessage({ type: "error", message: error.message });
		}
	}

	/**
	 * Принимает порции стрима, парсит и сохраняет файлы
	 */
	private async processStreamedText(chunk: string) {
		this.buffer += chunk;

		// 1) ловим начало файла
		const headerRe = /```[\w-]*\s*\n\/\/\s*File:\s*(.+?)\r?\n/;
		const headerMatch = headerRe.exec(chunk);
		if (headerMatch) {
			this.view.webview.postMessage({
				type: "fileStart",
				file: headerMatch[1].trim(),
			});
		}

		// 2) вырезаем законченные блоки кода
		const blockRe = /```([\w-]+)?\s*\n\/\/\s*File:\s*(.+?)\r?\n([\s\S]*?)```/gm;
		let match: RegExpExecArray | null;

		while ((match = blockRe.exec(this.buffer))) {
			const [, lang = "", rawName, content] = match;
			let fileName = rawName.trim();

			// если нет расширения — выводим из lang
			if (!/\.\w+$/.test(fileName)) {
				const ext =
					lang === "javascript"
						? "js"
						: lang === "typescript"
						? "ts"
						: lang || "txt";
				fileName = `${fileName}.${ext}`;
			}

			// сохраняем файл
			this.view.webview.postMessage({ type: "fileEnd", file: fileName });
			await this.fileWriter.writeFile(fileName, content);
			this.view.webview.postMessage({ type: "fileSaved", file: fileName });

			// чистим буфер
			this.buffer = this.buffer.slice(match.index + match[0].length);
			blockRe.lastIndex = 0;
		}
	}
}
