import * as vscode from "vscode";
import { readFileSync } from "fs";
import { join } from "path";

import { ProjectState } from "./projectState";
import { ClaudeClient } from "./claudeClient";
import { PromptController } from "./promptController";
import { FileWriter } from "./fileWriter";

export function activate(ctx: vscode.ExtensionContext) {
	const provider = new VibeCodingViewProvider(ctx);
	ctx.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			VibeCodingViewProvider.viewType,
			provider
		)
	);
	vscode.commands.executeCommand("workbench.view.extension.vibeCoding");

	// отдельная команда (если нужна): просто раскрываем сайдбар
	ctx.subscriptions.push(
		vscode.commands.registerCommand("expoClaude.start", () => {
			vscode.commands.executeCommand("workbench.view.extension.vibeCoding");
		})
	);
}

export function deactivate() {}

function getNonce(): string {
	return Math.random().toString(36).slice(2, 10);
}

class VibeCodingViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "vibeCodingView";

	private _view?: vscode.WebviewView;
	private promptController?: PromptController;

	constructor(private readonly ctx: vscode.ExtensionContext) {}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;
		const webview = webviewView.webview;
		const nonce = getNonce();

		webview.options = {
			enableScripts: true,
			localResourceRoots: [this.ctx.extensionUri],
		};

		const htmlPath = join(
			this.ctx.extensionUri.fsPath,
			"src",
			"webview",
			"index.html"
		);
		const scriptPath = join(this.ctx.extensionUri.fsPath, "dist", "webview.js");

		webview.html = readFileSync(htmlPath, "utf8")
			.replace(/\$\{nonce\}/g, nonce)
			.replace(/\$\{cspSource\}/g, webview.cspSource)
			.replace(
				/\$\{scriptUri\}/g,
				webview.asWebviewUri(vscode.Uri.file(scriptPath)).toString()
			);

		// ─── Новая бизнес-логика ──────────────────────────────
		const apiKey =
			vscode.workspace
				.getConfiguration()
				.get<string>("expoClaude.anthropicApiKey") ??
			vscode.workspace
				.getConfiguration("expoClaude")
				.get<string>("anthropicApiKey") ??
			"";

		this.promptController = new PromptController(
			new ProjectState(),
			new ClaudeClient(""),
			new FileWriter(),
			webviewView // передаём WebView для сообщений
		);

		// сообщения из React-приложения
		webview.onDidReceiveMessage(async (msg) => {
			const fileWriter = new FileWriter();

			if (!msg?.type) return;

			if (msg.type === "prompt") {
				await this.promptController!.handlePrompt(msg.value, msg.model);
			}

			if (msg.type === "action") {
				switch (msg.action) {
					case "installDeps":
						await fileWriter.installDependencies();
						webview.postMessage({
							type: "status",
							message: "Dependencies installing…",
						});
						break;
					case "startExpo":
						await fileWriter.startExpo();
						webview.postMessage({ type: "status", message: "Expo started." });
						break;
					case "stopExpo":
						await fileWriter.stopExpo();
						webview.postMessage({ type: "status", message: "Expo stopped." });
						break;
					case "deleteNodeModules":
						await fileWriter.deleteNodeModules();
						webview.postMessage({
							type: "status",
							message: "node_modules removed.",
						});
						break;
				}
			}
		});
	}
}
