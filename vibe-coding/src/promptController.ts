// File: PromptController.ts
import * as vscode from "vscode";
import { ProjectState } from "./projectState";
import { ClaudeClient } from "./claudeClient";
import { FileWriter } from "./fileWriter";

export class PromptController {
	private projectState: ProjectState;
	private claudeClient: ClaudeClient;
	private fileWriter: FileWriter;
	private view: vscode.WebviewView;
	private buffer = "";

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
	}

	async handlePrompt(prompt: string, model: string): Promise<void> {
		this.projectState.addUserMessage(prompt);
		this.view.webview.postMessage({
			type: "status",
			message: "Processing...",
		});
		this.view.show?.(true);

		try {
			await this.claudeClient.sendMessageStream(
				this.projectState.getConversation(),
				model,
				(chunk) => this.processStreamedText(chunk)
			);

			await this.fileWriter.installDependenciesAndLaunch();

			this.view.webview.postMessage({
				type: "done",
				message: "Done... let's launch it. (npx expo start).",
			});
		} catch (error: any) {
			this.view.webview.postMessage({ type: "error", message: error.message });
			console.error("Error during prompt handling:", error);
		}
	}

	private async processStreamedText(chunk: string) {
		this.buffer += chunk;

		// Отправляем событие начала файла, как только встретили его заголовок
		const headerRe = /```[\w-]*\s*\n\/\/\s*File:\s*(.+?)\r?\n/;
		const headerMatch = headerRe.exec(chunk);
		if (headerMatch) {
			this.view.webview.postMessage({
				type: "fileStart",
				file: headerMatch[1].trim(),
			});
		}

		// Парсим полностью полученные код-блоки
		const blockRe = /```([\w-]+)?\s*\n\/\/\s*File:\s*(.+?)\r?\n([\s\S]*?)```/gm;
		let match: RegExpExecArray | null;

		while ((match = blockRe.exec(this.buffer))) {
			const [, lang = "", rawName, content] = match;
			let fileName = rawName.trim();

			if (!/\.\w+$/.test(fileName)) {
				const ext =
					lang === "javascript"
						? "js"
						: lang === "typescript"
						? "ts"
						: lang || "txt";
				fileName = `${fileName}.${ext}`;
			}

			// Файл завершён генерацией – сообщаем и сохраняем
			this.view.webview.postMessage({ type: "fileEnd", file: fileName });
			await this.fileWriter.writeFile(fileName, content);
			this.view.webview.postMessage({ type: "fileSaved", file: fileName });

			// Обрезаем из буфера обработанный блок
			this.buffer = this.buffer.slice(match.index + match[0].length);
			blockRe.lastIndex = 0;
		}
	}
}
