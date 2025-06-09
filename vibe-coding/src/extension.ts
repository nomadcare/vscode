import * as vscode from "vscode";
import { readFileSync, watch } from "fs";
import { join, dirname } from "path";
import QRCode from "qrcode";

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
	console.log(
		"[VibeCoding] Activated extension and registered VibeCodingViewProvider"
	);
}

export function deactivate() {}

function getNonce(): string {
	return Math.random().toString(36).slice(2, 10);
}

class VibeCodingViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "vibeCodingView";
	private promptController?: PromptController;
	private watcher?: vscode.FileSystemWatcher;

	constructor(private readonly ctx: vscode.ExtensionContext) {}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		console.log("[VibeCoding] resolveWebviewView called");
		const webview = webviewView.webview;
		const nonce = getNonce();

		webview.options = {
			enableScripts: true,
			localResourceRoots: [this.ctx.extensionUri],
		};

		// Determine workspace folder (user project) and path to package.json
		const workspaceFolders = vscode.workspace.workspaceFolders;
		let cwd = "";
		if (workspaceFolders && workspaceFolders.length > 0) {
			cwd = workspaceFolders[0].uri.fsPath;
		}
		const pkgPath = cwd ? join(cwd, "package.json") : "";

		// Function to read and post appInfo
		const postAppInfo = () => {
			let pkgName = "";
			let pkgVersion = "";
			if (pkgPath) {
				try {
					const pkgContent = readFileSync(pkgPath, "utf8");
					const pkg = JSON.parse(pkgContent);
					pkgName = pkg.name;
					pkgVersion = pkg.version;
					console.log(
						`[VibeCoding] workspace package.json name=${pkgName}, version=${pkgVersion}`
					);
				} catch (err) {
					console.error(
						"[VibeCoding] Failed to read workspace package.json:",
						err
					);
				}
			}
			webview.postMessage({
				type: "appInfo",
				name: pkgName,
				version: pkgVersion,
			});
		};

		// Initial HTML injection
		const htmlPath = join(
			this.ctx.extensionUri.fsPath,
			"src",
			"webview",
			"index.html"
		);
		const rawHtml = readFileSync(htmlPath, "utf8");
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.file(join(this.ctx.extensionUri.fsPath, "dist", "webview.js"))
		);
		const injectedHead = `
      <script nonce="${nonce}">
        window.appInfo = {};
      </script>
    `;
		const html = rawHtml
			.replace(/\$\{nonce\}/g, nonce)
			.replace(/\$\{cspSource\}/g, webview.cspSource)
			.replace("</head>", `${injectedHead}</head>`)
			.replace(/\$\{scriptUri\}/g, scriptUri.toString());
		webview.html = html;
		console.log("[VibeCoding] Webview HTML set");

		// Listen to filesystem changes on package.json
		if (pkgPath) {
			this.watcher = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(cwd, "package.json")
			);
			this.watcher.onDidChange(() => {
				console.log("[VibeCoding] Detected change in package.json");
				postAppInfo();
			});
			this.watcher.onDidCreate(() => {
				console.log("[VibeCoding] package.json created");
				postAppInfo();
			});
			this.watcher.onDidDelete(() => {
				console.log("[VibeCoding] package.json deleted");
				webview.postMessage({
					type: "appInfo",
					name: "Unknown",
					version: "0.0.0",
				});
			});
			this.ctx.subscriptions.push(this.watcher);
		}

		// Handle messages from the webview
		webview.onDidReceiveMessage(async (msg) => {
			console.log("[VibeCoding] Received message from webview:", msg);
			switch (msg.type) {
				case "readyForAppInfo":
				case "getActiveFile":
					postAppInfo();
					break;
				case "prompt":
					await this.promptController?.handlePrompt(msg.value, msg.model);
					break;
				case "action": {
					const fileWriter = new FileWriter();
					switch (msg.action) {
						case "installDeps":
							await fileWriter.installDependencies();
							webview.postMessage({
								type: "status",
								message: "Dependencies installing…",
							});
							break;
						case "startExpo": {
							const hostUri = await fileWriter.startExpo();
							const img = await QRCode.toDataURL(`exp://${hostUri}`);
							webview.postMessage({ type: "expoQr", url: hostUri, img });
							break;
						}
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
					break;
				}
				default:
					console.warn("[VibeCoding] Unknown message type:", msg.type);
			}
		});

		// Initialize PromptController
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
			webviewView
		);
		console.log("[VibeCoding] PromptController initialized");
	}
}
