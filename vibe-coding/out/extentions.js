"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
function activate(context) {
    // 1) Регистрируем провайдер WebviewView
    const provider = new VibeCodingViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(VibeCodingViewProvider.viewType, provider));
    // 2) По активации автоматически открываем наш контейнер
    //    ID для команды: workbench.view.extension.<viewsContainer.id>
    vscode.commands.executeCommand('workbench.view.extension.vibeCoding');
}
exports.activate = activate;
class VibeCodingViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView, _context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };
        webviewView.webview.html = this.getHtmlForWebview();
    }
    getHtmlForWebview() {
        // Здесь ваш HTML/CSS/JS для UI
        return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body>
        <h1>Vibe Coding Plugin</h1>
        <p>Ваше содержимое тут...</p>
      </body>
      </html>
    `;
    }
}
VibeCodingViewProvider.viewType = 'vibeCodingView';
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extentions.js.map