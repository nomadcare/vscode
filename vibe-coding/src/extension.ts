import * as vscode from "vscode";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export function activate(ctx: vscode.ExtensionContext) {
	const provider = new VibeCodingViewProvider(ctx.extensionUri);

	ctx.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			VibeCodingViewProvider.viewType,
			provider
		)
	);

	vscode.commands.executeCommand("workbench.view.extension.vibeCoding");

	ctx.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			provider.handleActiveEditorChange(editor);
		})
	);

	ctx.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(() => {
			if (vscode.window.visibleTextEditors.length === 0) return;
			provider.handleActiveEditorChange(vscode.window.activeTextEditor);
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
	private _activeFileInfo: {
		uri: vscode.Uri;
		fileName: string;
		content: string;
	} | null = null;

	constructor(private readonly extensionUri: vscode.Uri) {}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;
		const webview = webviewView.webview;
		const nonce = getNonce();

		webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};

		// Загрузка шаблона
		const htmlPath = join(
			this.extensionUri.fsPath,
			"src",
			"webview",
			"index.html"
		);
		const scriptPath = join(this.extensionUri.fsPath, "dist", "webview.js");
		let html = readFileSync(htmlPath, "utf8")
			.replace(/\$\{nonce\}/g, nonce)
			.replace(/\$\{cspSource\}/g, webview.cspSource)
			.replace(
				/\$\{scriptUri\}/g,
				webview.asWebviewUri(vscode.Uri.file(scriptPath)).toString()
			);

		webviewView.webview.html = html;

		// Сразу подхватываем текущий активный редактор
		this.handleActiveEditorChange(vscode.window.activeTextEditor);
		if (this._activeFileInfo) {
			this.postActiveFile(
				this._activeFileInfo.fileName,
				this._activeFileInfo.content
			);
		}

		webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case "getActiveFile":
					if (this._activeFileInfo) {
						this.postActiveFile(
							this._activeFileInfo.fileName,
							this._activeFileInfo.content
						);
					}
					break;

				case "simulate":
					if (this._activeFileInfo) {
						const { uri, content } = this._activeFileInfo;
						const header = `// ${msg.model} сгенерировал что-то\n`;
						const newContent = header + content;
						writeFileSync(uri.fsPath, newContent, "utf8");
						this._activeFileInfo.content = newContent;
						this.postActiveFile(this._activeFileInfo.fileName, newContent);
					}

					const randomHtml = `
            <div style="padding:20px;background:#${Math.floor(
							Math.random() * 0xffffff
						).toString(16)}">
              <h1>Random Preview</h1>
              <p>Prompt was: "${msg.prompt}"</p>
            </div>
            <div style="padding:8px 12px; font-size:12px; color:#0f0;">
              ${msg.model} сгенерировал ответ
            </div>
          `;
					this._view?.webview.postMessage({
						type: "simulateResponse",
						code: randomHtml,
					});
					break;
			}
		});
	}

	public handleActiveEditorChange(editor: vscode.TextEditor | undefined) {
		if (!editor) {
			this._activeFileInfo = null;
			return;
		}
		const doc = editor.document;
		const uri = doc.uri;
		const fileName = uri.fsPath.split(/[\/\\]/).pop() || "";
		const content = doc.getText();
		this._activeFileInfo = { uri, fileName, content };

		if (this._view) {
			this.postActiveFile(fileName, content);
		}
	}

	private postActiveFile(fileName: string, content: string) {
		this._view?.webview.postMessage({
			type: "activeFile",
			fileName,
			content,
		});
	}
}
