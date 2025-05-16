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

	async handlePrompt(prompt: string): Promise<void> {
		this.projectState.addUserMessage(prompt);
		this.view.webview.postMessage({
			type: "status",
			message: "Генерация проекта...",
		});
		this.view.show?.(true);

		try {
			await this.claudeClient.sendMessageStream(
				this.projectState.getConversation(),
				(partialText: string) => {
					this.processStreamedText(partialText);
				}
			);

			// После успешной генерации файлов — устанавливаем зависимости и запускаем проект
			await this.fileWriter.installDependenciesAndLaunch();

			this.view.webview.postMessage({
				type: "done",
				message: "Проект сгенерирован и запущен (npx expo start).",
			});
		} catch (error: any) {
			this.view.webview.postMessage({ type: "error", message: error.message });
			console.error("Error during prompt handling:", error);
		}
	}

	private async processStreamedText(chunk: string) {
		this.buffer += chunk;
		this.view.webview.postMessage({ type: "partial", content: chunk });

		const blockRe = /```(\w+)\s*\n\/\/\s*File:\s*(.+?)\r?\n([\s\S]*?)```/;
		let match: RegExpExecArray | null;

		while ((match = blockRe.exec(this.buffer))) {
			const [, lang, rawName, content] = match;
			let fileName = rawName.trim();
			if (!/\.\w+$/.test(fileName)) {
				const ext =
					lang === "javascript" ? "js" : lang === "typescript" ? "ts" : lang;
				fileName = `${fileName}.${ext}`;
			}

			await this.fileWriter.writeFile(fileName, content);
			this.view.webview.postMessage({ type: "fileSaved", file: fileName });

			// Убираем обработанный блок из буфера
			this.buffer = this.buffer.slice(match.index! + match[0].length);
		}
	}
}
