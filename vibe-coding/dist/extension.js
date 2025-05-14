"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var import_fs = require("fs");
var import_path = require("path");
function activate(ctx) {
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
function deactivate() {
}
function getNonce() {
  return Math.random().toString(36).slice(2, 10);
}
var VibeCodingViewProvider = class {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
    this._activeFileInfo = null;
  }
  static {
    this.viewType = "vibeCodingView";
  }
  resolveWebviewView(webviewView) {
    this._view = webviewView;
    const webview = webviewView.webview;
    const nonce = getNonce();
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    const htmlPath = (0, import_path.join)(
      this.extensionUri.fsPath,
      "src",
      "webview",
      "index.html"
    );
    const scriptPath = (0, import_path.join)(this.extensionUri.fsPath, "dist", "webview.js");
    let html = (0, import_fs.readFileSync)(htmlPath, "utf8").replace(/\$\{nonce\}/g, nonce).replace(/\$\{cspSource\}/g, webview.cspSource).replace(
      /\$\{scriptUri\}/g,
      webview.asWebviewUri(vscode.Uri.file(scriptPath)).toString()
    );
    webviewView.webview.html = html;
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
            const header = `// ${msg.model} \u0441\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u043B \u0447\u0442\u043E-\u0442\u043E
`;
            const newContent = header + content;
            (0, import_fs.writeFileSync)(uri.fsPath, newContent, "utf8");
            this._activeFileInfo.content = newContent;
            this.postActiveFile(this._activeFileInfo.fileName, newContent);
          }
          const randomHtml = `
            <div style="padding:20px;background:#${Math.floor(
            Math.random() * 16777215
          ).toString(16)}">
              <h1>Random Preview</h1>
              <p>Prompt was: "${msg.prompt}"</p>
            </div>
            <div style="padding:8px 12px; font-size:12px; color:#0f0;">
              ${msg.model} \u0441\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u043B \u043E\u0442\u0432\u0435\u0442
            </div>
          `;
          this._view?.webview.postMessage({
            type: "simulateResponse",
            code: randomHtml
          });
          break;
      }
    });
  }
  handleActiveEditorChange(editor) {
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
  postActiveFile(fileName, content) {
    this._view?.webview.postMessage({
      type: "activeFile",
      fileName,
      content
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
