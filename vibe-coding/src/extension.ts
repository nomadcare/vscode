import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
	const provider = new VibeCodingViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			VibeCodingViewProvider.viewType,
			provider
		)
	);

	// Открываем наш контейнер в боковой панели слева
	vscode.commands.executeCommand("workbench.view.extension.vibeCoding");
}

class VibeCodingViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "vibeCodingView";

	constructor(private readonly extensionUri: vscode.Uri) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};
		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vibe Chat</title>
  <style>
    :root {
      --sidebar-width: 50px;
      --header-height: 60px;
      --input-height: 60px;
      --bg: #000000;
      --bg-alt: #0a0a0a;
      --fg: #ededed;
      --accent: #0a84ff;
      --font-family: 'Segoe UI', 'Roboto', sans-serif;
      --base-font-size: 15px;
      --border-color: #444444;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0; height: 100vh;
      display: flex;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-family);
      font-size: var(--base-font-size);
    }
    .sidebar {
      width: var(--sidebar-width);
      background: var(--bg-alt);
      display: flex; flex-direction: column;
      align-items: center;
      padding-top: 12px;
      border-right: 1px solid var(--border-color);
    }
    .sidebar button {
      background: transparent;
      border: none;
      margin: 10px 0;
      width: 32px; height: 32px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--fg);
      font-size: 18px;
    }
    .sidebar button:hover { background: rgba(255,255,255,0.1); }
    .main { flex: 1; display: flex; flex-direction: column; }
    .header {
      height: var(--header-height);
      display: flex;
      align-items: center;
      padding: 0 16px;
      background: var(--bg-alt);
      border-bottom: 1px solid var(--border-color);
      font-weight: 600;
      font-size: 16px;
    }
    .header .title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .chat {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex; flex-direction: column;
      gap: 12px;
      border-left: 1px solid var(--border-color);
    }
    .message { line-height: 1.5; max-width: 75%; }
    .message.agent { align-self: flex-start; }
    .message.agent .meta {
      font-size: 12px; color: #999;
      margin-bottom: 4px; display: flex; align-items: center;
    }
    .message.agent .meta .dot {
      width: 8px; height: 8px;
      background: var(--accent);
      border-radius: 50%; margin-right: 6px;
    }
    .message.agent .content {
      background: var(--bg-alt);
      padding: 12px; border-radius: 6px;
      border: 1px solid var(--border-color);
      font-weight: 400;
    }
    .message.user { align-self: flex-end; }
    .message.user .content {
      background: var(--accent);
      color: var(--bg);
      padding: 12px; border-radius: 6px;
      font-weight: 500;
      border: 1px solid var(--border-color);
    }
    .input {
      height: var(--input-height);
      display: flex;
      border-top: 1px solid var(--border-color);
      background: var(--bg-alt);
      padding: 0 12px;
      align-items: center;
    }
    .input textarea {
      flex: 1; height: 40px;
      resize: none;
      border: 1px solid var(--border-color);
      outline: none;
      background: #111;
      color: var(--fg);
      padding: 10px; border-radius: 6px;
      font-size: 14px; font-family: var(--font-family);
    }
    .input button {
      background: var(--accent);
      border: 1px solid var(--border-color);
      color: var(--bg);
      padding: 8px 16px;
      margin-left: 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      font-family: var(--font-family);
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <button title="New Chat">＋</button>
    <button title="All Chats">☰</button>
  </div>
  <div class="main">
    <div class="header">
      <div class="title">
        Home Search Platform
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--fg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
    <div class="chat" id="chat">
      <div class="message agent">
        <div class="meta"><span class="dot"></span>Rork</div>
        <div class="content">Привет! Чем могу помочь?</div>
      </div>
    </div>
    <div class="input">
      <textarea id="input" placeholder="Опишите ваш запрос…"></textarea>
      <button id="send">Send</button>
    </div>
  </div>
  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    const send = document.getElementById('send');

    send.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;

      const userMsg = document.createElement('div');
      userMsg.className = 'message user';
      userMsg.innerHTML = '<div class="content"></div>';
      userMsg.querySelector('.content').innerText = text;
      chat.appendChild(userMsg);
      input.value = '';
      chat.scrollTop = chat.scrollHeight;

      setTimeout(() => {
        const agentMsg = document.createElement('div');
        agentMsg.className = 'message agent';
        agentMsg.innerHTML =
          '<div class="meta"><span class="dot"></span>Rork</div>' +
          '<div class="content">Это ответ агента на: "' + text + '"</div>';
        chat.appendChild(agentMsg);
        chat.scrollTop = chat.scrollHeight;
      }, 500);
    });
  </script>
</body>
</html>`;
	}
}

export function deactivate() {}
