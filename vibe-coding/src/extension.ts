import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
	const provider = new VibeCodingViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			VibeCodingViewProvider.viewType,
			provider
		)
	);
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
		webviewView.webview.html = this.getHtml(webviewView.webview);
	}

	private getHtml(webview: vscode.Webview) {
		const csp = webview.cspSource;
		return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src ${csp} 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Vibe Chat</title>
  <style>
    :root {
      --sidebar-width: 50px;
      --header-height: 60px;
      --input-height: 80px;
      --bg: #000;
      --bg-alt: #000;
      --fg: #ededed;
      --border: #444;
      --accent: #0a84ff;
      --font: 'Segoe UI','Roboto',sans-serif;
      --fz-base: 15px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
	  html, body {
	    height: 100vh; display: flex;
      	background: var(--bg); color: var(--fg);
      	font-family: var(--font); font-size: var(--fz-base);
		/* полностью убираем любые отступы у самого документа */
		margin: 0;
		padding: 0;
		/* гарантируем, что займут всю ширину/высоту контейнера */
		width: 100%;
		height: 100%;
	}
    .sidebar {
      width: var(--sidebar-width); background: var(--bg-alt);
      display: flex; flex-direction: column; align-items: center;
      padding: 12px 0; border-right: 1px solid var(--border);
    }
    .sidebar button {
      background: transparent; border: none; color: var(--fg);
      width: 32px; height: 32px; margin: 8px 0;
      border-radius: 6px; cursor: pointer; font-size: 18px;
    }
    .sidebar button:hover { background: rgba(255,255,255,0.1); }

    .main { flex: 1; display: flex; flex-direction: column; }
    .header {
      height: var(--header-height); display: flex; align-items: center;
      padding: 0 16px; background: var(--bg-alt);
      border-bottom: 1px solid var(--border); font-weight: 600;
    }
    .header .title { display: flex; align-items: center; gap: 8px; }

    .chat {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      border-left: 1px solid var(--border);
    }
    .message { max-width: 75%; line-height: 1.5; }
    .message.agent { align-self: flex-start; }
    .message.agent .meta {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #999; margin-bottom: 4px;
    }
    .message.agent .meta .dot {
      width: 8px; height: 8px; background: var(--accent);
      border-radius: 50%;
    }
    .message.agent .content {
      background: var(--bg-alt); padding: 12px; border-radius: 6px;
      border: 1px solid var(--border); font-weight: 400;
    }
    .message.user { align-self: flex-end; }
    .message.user .content {
      background: var(--accent); color: var(--bg);
      padding: 12px; border-radius: 6px;
      border: 1px solid var(--border); font-weight: 500;
    }

    .input-bar {
      height: var(--input-height); display: flex; align-items: center;
      padding: 0 16px; background: var(--bg-alt);
      border-top: 1px solid var(--border); gap: 12px;
    }
    .input-buttons { display: flex; gap: 8px; }

    .btn {
      background: transparent; border: none; color: var(--fg);
      display: flex; align-items: center; justify-content: center;
      padding: 8px; border-radius: 6px; cursor: pointer;
    }
    .btn:hover { background: rgba(255,255,255,0.1); }

    .text-input {
      flex: 1; height: 50px; padding: 0 12px;
      border: 1px solid var(--border); border-radius: 8px;
      background: #111; color: var(--fg);
      font-size: 14px; outline: none;
    }
    .text-input::placeholder { color: #777; }

    .input-right { display: flex; align-items: center; }
    .send-btn {
      background: var(--accent); border: none;
      padding: 10px; border-radius: 8px; color: var(--bg);
      margin-left: 8px; cursor: pointer;
    }
    .send-btn:hover { opacity: 0.9; }

    /* model dropdown */
    .model-dropdown { position: relative; }
    .model-btn { display: flex; align-items: center; gap: 4px; }
    .model-btn .arrow { transition: transform .2s; }
    .model-btn.open .arrow { transform: rotate(180deg); }
    .dropdown-menu {
      position: absolute; left: 0; bottom: calc(var(--input-height) + 4px);
      width: 240px; background: var(--bg-alt);
      border: 1px solid var(--border); border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5); z-index: 10;
    }
    .dropdown-menu.hidden { display: none; }

    .dropdown-header {
      padding: 12px; font-size: 13px; font-weight: 600;
      color: #888;
    }
    .dropdown-item {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 12px; cursor: pointer;
    }
    .dropdown-item:hover { background: rgba(255,255,255,0.1); }
    .dropdown-item .icon {
      width: 32px; height: 32px;
      border: 1px solid var(--border); border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
    }
    .dropdown-item .texts {
      flex: 1; display: flex; flex-direction: column;
    }
    .dropdown-item .texts .title {
      font-size: 14px; font-weight: 500;
    }
    .dropdown-item .texts .desc {
      font-size: 12px; color: #999;
    }
    .dropdown-item .radio {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid var(--accent); display: flex;
      align-items: center; justify-content: center;
    }
    .dropdown-item.selected .radio {
      background: var(--accent);
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="var(--fg)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
    </div>

    <div class="chat" id="chat">
      <div class="message agent">
        <div class="meta"><span class="dot"></span>Rork</div>
        <div class="content">Привет! Чем могу помочь?</div>
      </div>
    </div>

    <div class="input-bar">
      <div class="input-buttons">
        <button class="btn" title="Upload image">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <div class="model-dropdown">
          <button class="btn model-btn" id="modelBtn" title="AI model">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C8.1 2 5 5.1 5 9c0 1.9.8 3.6 2.1 4.8L5 18l5-1.5
                       c.8.4 1.6.7 2.5.7 3.9 0 7-3.1 7-7s-3.1-7-7-7z"/>
              <path d="M12 2v20"/>
            </svg>
            <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="dropdown-menu hidden" id="modelMenu">
            <div class="dropdown-header">AI model</div>
            <div class="dropdown-item selected" data-model="sonnet-3.7">
              <div class="icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2C8.1 2 5 5.1 5 9c0 1.9.8 3.6 2.1 4.8L5 18l5-1.5
                           c.8.4 1.6.7 2.5.7 3.9 0 7-3.1 7-7s-3.1-7-7-7z"/>
                  <path d="M12 2v20"/>
                </svg>
              </div>
              <div class="texts">
                <div class="title">Sonnet 3.7</div>
                <div class="desc">Best model, but can do things you didn't ask for</div>
              </div>
              <div class="radio"></div>
            </div>
            <div class="dropdown-item" data-model="sonnet-3.6">
              <div class="icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
              </div>
              <div class="texts">
                <div class="title">Focus (Sonnet 3.6)</div>
                <div class="desc">Good at coding and design</div>
              </div>
              <div class="radio"></div>
            </div>
            <div class="dropdown-item" data-model="grok">
              <div class="icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10 10 0 0 1 6.06 6.06"/>
                  <path d="M1 1l22 22"/>
                </svg>
              </div>
              <div class="texts">
                <div class="title">Focus (Grok)</div>
                <div class="desc">Great at coding, but not so good at design</div>
              </div>
              <div class="radio"></div>
            </div>
          </div>
        </div>
      </div>

      <input id="textInput" class="text-input"
             type="text"
             placeholder="Describe the mobile app you want to build..." />

      <div class="input-right">
        <button class="send-btn btn" id="sendBtn" title="Send">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <script>
    const chat = document.getElementById("chat");
    const input = document.getElementById("textInput");
    const sendBtn = document.getElementById("sendBtn");
    const modelBtn = document.getElementById("modelBtn");
    const modelMenu = document.getElementById("modelMenu");

    modelBtn.addEventListener("click", e => {
      e.stopPropagation();
      modelBtn.classList.toggle("open");
      modelMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
      modelBtn.classList.remove("open");
      modelMenu.classList.add("hidden");
    });

    Array.from(modelMenu.querySelectorAll(".dropdown-item")).forEach(item => {
      item.addEventListener("click", e => {
        modelMenu.querySelector(".selected")?.classList.remove("selected");
        item.classList.add("selected");
        modelBtn.classList.remove("open");
        modelMenu.classList.add("hidden");
        // here you can store selected model from item.dataset.model
      });
    });

    function sendMessage(text) {
      const msg = document.createElement("div");
      msg.className = "message user";
      msg.innerHTML = \`<div class="content">\${text}</div>\`;
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
      input.value = "";
      setTimeout(() => {
        const r = document.createElement("div");
        r.className = "message agent";
        r.innerHTML = \`
          <div class="meta"><span class="dot"></span>Rork</div>
          <div class="content">Это ответ агента на: "\${text}"</div>
        \`;
        chat.appendChild(r);
        chat.scrollTop = chat.scrollHeight;
      }, 500);
    }

    sendBtn.addEventListener("click", () => {
      const txt = input.value.trim();
      if (txt) sendMessage(txt);
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        const txt = input.value.trim();
        if (txt) sendMessage(txt);
      }
    });
  </script>
</body>
</html>`;
	}
}

export function deactivate() {}
