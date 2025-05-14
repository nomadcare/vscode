// src/webview/App.tsx

import React, { useEffect, useState, useRef } from "react";
declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

export default function App() {
	const [chats, setChats] = useState<
		{ sender: "agent" | "user"; text: string }[]
	>([{ sender: "agent", text: "Привет! Чем могу помочь?" }]);
	const [input, setInput] = useState("");
	const [modelMenuOpen, setModelMenuOpen] = useState(false);
	const [selectedModel, setSelectedModel] = useState<
		"sonnet-3.7" | "sonnet-3.6" | "grok"
	>("sonnet-3.7");
	const [activeFileName, setActiveFileName] = useState<string>("");
	const chatRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// при монтировании сразу запросить активный файл
		vscode.postMessage({ type: "getActiveFile" });

		// слушаем ответы от расширения
		const onMessage = (event: MessageEvent) => {
			const msg = event.data;
			if (msg.type === "activeFile") {
				setActiveFileName(msg.fileName);
			} else if (msg.type === "simulateResponse") {
				appendMessage("agent", msg.code);
			}
		};
		window.addEventListener("message", onMessage);

		// клики вне меню закрывают дропдаун
		const onClickOutside = () => setModelMenuOpen(false);
		document.addEventListener("click", onClickOutside);

		return () => {
			window.removeEventListener("message", onMessage);
			document.removeEventListener("click", onClickOutside);
		};
	}, []);

	const appendMessage = (sender: "agent" | "user", text: string) => {
		setChats((prev) => [...prev, { sender, text }]);
		setTimeout(() => {
			chatRef.current?.scrollTo({
				top: chatRef.current.scrollHeight,
				behavior: "smooth",
			});
		}, 0);
	};

	const handleSend = () => {
		if (!input.trim()) return;
		appendMessage("user", input);
		vscode.postMessage({
			type: "simulate",
			prompt: input,
			model: selectedModel,
		});
		setInput("");
	};

	return (
		<>
			<style>{`
        :root {
          --sidebar-width: 50px;
          --header-height: 60px;
          --input-height: 80px;
          --bg: #000;
          --bg-alt: #111;
          --fg: #ededed;
          --border: #444;
          --accent: #0a84ff;
          --font: 'Segoe UI','Roboto',sans-serif;
          --fz-base: 15px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root {
          height: 100%; width: 100%;
          background: var(--bg); color: var(--fg);
          font-family: var(--font); font-size: var(--fz-base);
        }
        .sidebar {
          width: var(--sidebar-width);
          background: var(--bg-alt);
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
        .active-file {
          margin-left: auto;
          display: flex; align-items: center;
          color: #0f0;
          font-size: 14px;
        }
        .active-file .green-dot {
          width: 8px; height: 8px;
          background: #0f0;
          border-radius: 50%;
          margin-right: 6px;
        }
        .chat {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .message {
          max-width: 75%; line-height: 1.5;
        }
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
          border: 1px solid var(--border);
        }
        .message.user { align-self: flex-end; }
        .message.user .content {
          background: var(--accent); color: var(--bg);
          padding: 12px; border-radius: 6px;
          border: 1px solid var(--border);
        }
        .input-bar {
          height: var(--input-height); display: flex; align-items: center;
          padding: 0 16px; background: var(--bg-alt);
          border-top: 1px solid var(--border); gap: 12px;
        }
        .btn {
          background: transparent; border: none; color: var(--fg);
          display: flex; align-items: center; justify-content: center;
          padding: 8px; border-radius: 6px; cursor: pointer;
        }
        .btn:hover { background: rgba(255,255,255,0.1); }
        .text-input {
          flex: 1; height: 50px; padding: 0 12px;
          border: 1px solid var(--border); border-radius: 8px;
          background: #111; color: var(--fg); font-size: 14px;
        }
        .text-input::placeholder { color: #777; }
        .send-btn {
          background: var(--accent); border: none;
          padding: 10px; border-radius: 8px; color: var(--bg);
          cursor: pointer;
        }
        .send-btn:hover { opacity: 0.9; }
        .model-dropdown { position: relative; }
        .model-menu {
          position: absolute; left: 0; bottom: calc(var(--input-height) + 4px);
          width: 240px; background: var(--bg-alt);
          border: 1px solid var(--border); border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5); z-index: 10;
        }
        .model-item {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 12px; cursor: pointer;
        }
        .model-item:hover { background: rgba(255,255,255,0.1); }
        .model-item.selected .radio { background: var(--accent); }
        .radio {
          width: 12px; height: 12px; border-radius: 50%;
          border: 2px solid var(--accent);
        }
      `}</style>

			<div style={{ display: "flex", height: "100%" }}>
				<div className="sidebar">
					<button title="New Chat">＋</button>
					<button title="All Chats">☰</button>
				</div>

				<div className="main">
					<div className="header">
						Home Search Platform
						{activeFileName && (
							<div className="active-file">
								<span className="green-dot" />
								{activeFileName}
							</div>
						)}
					</div>

					<div className="chat" ref={chatRef}>
						{chats.map((m, i) => (
							<div key={i} className={`message ${m.sender}`}>
								{m.sender === "agent" && (
									<div className="meta">
										<span className="dot" />
										{selectedModel}
									</div>
								)}
								<div
									className="content"
									dangerouslySetInnerHTML={{ __html: m.text }}
								/>
							</div>
						))}
					</div>

					<div className="input-bar">
						<button className="btn" title="Upload image">
							📷
						</button>

						<div
							className="model-dropdown"
							onClick={(e) => {
								e.stopPropagation();
								setModelMenuOpen((o) => !o);
							}}
						>
							<button className="btn">{selectedModel}</button>
							{modelMenuOpen && (
								<div className="model-menu">
									{[
										{ id: "sonnet-3.7", name: "Sonnet 3.7" },
										{ id: "sonnet-3.6", name: "Focus (Sonnet 3.6)" },
										{ id: "grok", name: "Focus (Grok)" },
									].map((m) => (
										<div
											key={m.id}
											className={`model-item ${
												selectedModel === m.id ? "selected" : ""
											}`}
											onClick={() => setSelectedModel(m.id as any)}
										>
											<div className="radio" />
											<div>{m.name}</div>
										</div>
									))}
								</div>
							)}
						</div>

						<input
							className="text-input"
							placeholder="Describe the mobile app you want to build..."
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleSend();
								}
							}}
						/>

						<button className="send-btn" onClick={handleSend}>
							➤
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
