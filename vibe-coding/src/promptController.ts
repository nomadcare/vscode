import * as vscode from "vscode";
import { ProjectState } from "./projectState";
import { ClaudeClient } from "./claudeClient";
import { FileWriter } from "./fileWriter";

export class PromptController {
	private projectState: ProjectState;
	private claudeClient: ClaudeClient;
	private fileWriter: FileWriter;
	private view: vscode.WebviewView;

	// Промежуточные буферы для парсинга
	private currentFileName: string | null = null;
	private currentFileContent: string = "";

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

	// Обработка нового промпта от пользователя
	async handlePrompt(prompt: string): Promise<void> {
		// Добавляем сообщение пользователя в историю
		this.projectState.addUserMessage(prompt);

		// Отображаем в UI, что началась генерация
		this.view.webview.postMessage({
			type: "status",
			message: "Генерация проекта...",
		});

		// При необходимости показываем view
		this.view.show?.(true);

		try {
			// Вызов клиента Claude с передачей всей истории сообщений и обработкой стриминга
			await this.claudeClient.sendMessageStream(
				this.projectState.getConversation(),
				(partialText: string) => {
					// По мере получения новых частей текста от AI
					this.processStreamedText(partialText);
				}
			);

			// Когда стриминг завершен, закрываем текущий файл, если он еще не закрыт
			if (this.currentFileName) {
				await this.fileWriter.writeFile(
					this.currentFileName,
					this.currentFileContent
				);
				this.view.webview.postMessage({
					type: "fileSaved",
					file: this.currentFileName,
				});
			}

			// Сброс состояния парсинга
			this.currentFileName = null;
			this.currentFileContent = "";

			// Установка зависимостей и запуск приложения
			await this.fileWriter.installDependenciesAndLaunch();

			// Уведомляем UI о завершении
			this.view.webview.postMessage({
				type: "done",
				message: "Проект сгенерирован и запущен (npx expo start).",
			});
		} catch (error: any) {
			const errMsg = error.message || String(error);
			this.view.webview.postMessage({ type: "error", message: errMsg });
			console.error("Error during prompt handling:", errMsg);
		}
	}

	// Обработка поступающих кусков текста от Claude (streaming)
	private processStreamedText(textChunk: string) {
		// Логгируем часть текста в UI
		this.view.webview.postMessage({ type: "partial", content: textChunk });

		let text = textChunk;
		while (text.length > 0) {
			if (!this.currentFileName) {
				const startIndex = text.indexOf("```");
				if (startIndex !== -1) {
					text = text.substring(startIndex + 3);
					const newlineIndex = text.indexOf("\n");
					if (newlineIndex !== -1) {
						text = text.substring(newlineIndex + 1);
					}
				} else {
					return;
				}
			}

			if (!this.currentFileName) {
				const fileTag = "// File:";
				const fileTagIndex = text.indexOf(fileTag);
				if (fileTagIndex !== -1) {
					const endOfLineIdx = text.indexOf("\n");
					const firstLine =
						endOfLineIdx !== -1 ? text.substring(0, endOfLineIdx) : text;
					const fileName = firstLine.replace(fileTag, "").trim();
					this.currentFileName = fileName;
					this.currentFileContent = "";
					this.view.webview.postMessage({ type: "fileStart", file: fileName });
					text = endOfLineIdx !== -1 ? text.substring(endOfLineIdx + 1) : "";
					continue;
				} else {
					return;
				}
			}

			const endCodeIndex = text.indexOf("```");
			if (endCodeIndex !== -1) {
				const fileContentPart = text.substring(0, endCodeIndex);
				this.currentFileContent += fileContentPart;
				if (this.currentFileName) {
					this.fileWriter
						.writeFile(this.currentFileName, this.currentFileContent)
						.then(() => {
							this.view.webview.postMessage({
								type: "fileSaved",
								file: this.currentFileName!,
							});
						})
						.catch((err) => {
							this.view.webview.postMessage({
								type: "error",
								message: `Не удалось сохранить ${this.currentFileName}: ${err}`,
							});
						});
				}
				this.projectState.addAssistantMessage(
					`Контент файла ${this.currentFileName}:\n${this.currentFileContent}`
				);
				const finishedFile = this.currentFileName;
				this.currentFileName = null;
				this.currentFileContent = "";
				text = text.substring(endCodeIndex + 3);
				this.view.webview.postMessage({ type: "fileEnd", file: finishedFile! });
				continue;
			} else {
				this.currentFileContent += text;
				this.view.webview.postMessage({
					type: "fileContent",
					file: this.currentFileName!,
					content: text,
				});
				text = "";
			}
		}
	}
}
