// File: PromptController.ts
import * as vscode from "vscode";
import { ProjectState } from "./projectState";
import { ClaudeClient } from "./claudeClient";
import { FileWriter } from "./fileWriter";
import { ProjectSnapshot } from "./projectSnapshot";

/**
 * PromptController
 * ----------------
 * На первый запрос отправляет стартовый SYSTEM-prompt и ведёт разговор «как раньше».
 * На второй и дальнейшие запросы вместо истории чата формирует SYSTEM-override,
 * куда кладёт **актуальный снимок проекта** (без node_modules, билд-папок, больших или бинарных файлов).
 * В messages при этом уходит только свежий запрос пользователя — экономим токены
 * и даём модели полную картину кода.
 */
export class PromptController {
	private projectState: ProjectState;
	private claudeClient: ClaudeClient;
	private fileWriter: FileWriter;
	private view: vscode.WebviewView;
	private buffer = "";

	/** Снимок проекта для отправки во втором и последующих запросах */
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

		// Берём корень первого открытого workspace-фолдера или cwd
		const root =
			vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? process.cwd();
		this.snapshot = new ProjectSnapshot(root);
	}

	/**
	 * Обрабатывает пользовательский ввод и стримит ответ Claude
	 */
	async handlePrompt(prompt: string, model: string): Promise<void> {
		// 1) фиксируем запрос в state (история нам всё ещё нужна локально)
		this.projectState.addUserMessage(prompt);

		// 2) показываем статус
		this.view.webview.postMessage({ type: "status", message: "Processing…" });
		this.view.show?.(true);

		// 3) определяем, первый ли это запрос
		const isFirst = this.projectState.getConversation().length === 1;

		// 4) формируем systemOverride: если не первый — кладём снимок проекта
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

		// 5) подготавливаем messages для Claude
		const messages = isFirst
			? this.projectState.getConversation() // первый запрос — со всеми предыдущими сообщениями (их всего два)
			: [{ role: "user" as const, content: prompt }]; // дальше — только свежий запрос

		try {
			// 6) стримим ответ
			const full = await this.claudeClient.sendMessageStream(
				messages,
				model,
				(chunk) => this.processStreamedText(chunk),
				systemOverride
			);

			// 7) сохраняем полный ответ ассистента
			this.projectState.addAssistantMessage(full);

			// 8) после генерации ставим зависимости и запускаем Expo
			await this.fileWriter.installDependenciesAndLaunch();

			this.view.webview.postMessage({
				type: "done",
				message: "Done… (npx expo start)",
			});
		} catch (error: any) {
			this.view.webview.postMessage({ type: "error", message: error.message });
		}
	}

	/**
	 * Принимает порции стрима от Claude, парсит заголовки файлов
	 * и записывает полностью полученные блоки на диск
	 */
	private async processStreamedText(chunk: string) {
		this.buffer += chunk;

		// 1) если встретился заголовок файла — говорим UI, что файл начался
		const headerRe = /```[\w-]*\s*\n\/\/\s*File:\s*(.+?)\r?\n/;
		const headerMatch = headerRe.exec(chunk);
		if (headerMatch) {
			this.view.webview.postMessage({
				type: "fileStart",
				file: headerMatch[1].trim(),
			});
		}

		// 2) перебираем полностью полученные код-блоки
		const blockRe = /```([\w-]+)?\s*\n\/\/\s*File:\s*(.+?)\r?\n([\s\S]*?)```/gm;
		let match: RegExpExecArray | null;

		while ((match = blockRe.exec(this.buffer))) {
			const [, lang = "", rawName, content] = match;
			let fileName = rawName.trim();

			// если расширения нет — выводим из языка блока
			if (!/\.\w+$/.test(fileName)) {
				const ext =
					lang === "javascript"
						? "js"
						: lang === "typescript"
						? "ts"
						: lang || "txt";
				fileName = `${fileName}.${ext}`;
			}

			// файл завершён — сохраняем
			this.view.webview.postMessage({ type: "fileEnd", file: fileName });
			await this.fileWriter.writeFile(fileName, content);
			this.view.webview.postMessage({ type: "fileSaved", file: fileName });

			// обрезаем обработанную часть из буфера и сбрасываем индекс регэкспа
			this.buffer = this.buffer.slice(match.index + match[0].length);
			blockRe.lastIndex = 0;
		}
	}
}
