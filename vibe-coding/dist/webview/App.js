"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
// src/webview/App.tsx
const react_1 = require("react");
const vscode = acquireVsCodeApi();
function App() {
    const [chats, setChats] = (0, react_1.useState)([{ sender: "agent", text: "Привет! Чем могу помочь?" }]);
    const [input, setInput] = (0, react_1.useState)("");
    const [modelMenuOpen, setModelMenuOpen] = (0, react_1.useState)(false);
    const [selectedModel, setSelectedModel] = (0, react_1.useState)("sonnet-3.7");
    const [activeFileName, setActiveFileName] = (0, react_1.useState)("");
    const chatRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        // при монтировании сразу запросить активный файл
        vscode.postMessage({ type: "getActiveFile" });
        // слушаем ответы от расширения
        const onMessage = (event) => {
            const msg = event.data;
            if (msg.type === "activeFile") {
                setActiveFileName(msg.fileName);
            }
            else if (msg.type === "simulateResponse") {
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
    const appendMessage = (sender, text) => {
        setChats((prev) => [...prev, { sender, text }]);
        setTimeout(() => {
            var _a;
            (_a = chatRef.current) === null || _a === void 0 ? void 0 : _a.scrollTo({
                top: chatRef.current.scrollHeight,
                behavior: "smooth",
            });
        }, 0);
    };
    const handleSend = () => {
        if (!input.trim())
            return;
        appendMessage("user", input);
        vscode.postMessage({
            type: "simulate",
            prompt: input,
            model: selectedModel,
        });
        setInput("");
    };
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("style", { children: `
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
      ` }), (0, jsx_runtime_1.jsxs)("div", Object.assign({ style: { display: "flex", height: "100%" } }, { children: [(0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "sidebar" }, { children: [(0, jsx_runtime_1.jsx)("button", Object.assign({ title: "New Chat" }, { children: "\uFF0B" })), (0, jsx_runtime_1.jsx)("button", Object.assign({ title: "All Chats" }, { children: "\u2630" }))] })), (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "main" }, { children: [(0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "header" }, { children: ["Home Search Platform", activeFileName && ((0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "active-file" }, { children: [(0, jsx_runtime_1.jsx)("span", { className: "green-dot" }), activeFileName] })))] })), (0, jsx_runtime_1.jsx)("div", Object.assign({ className: "chat", ref: chatRef }, { children: chats.map((m, i) => ((0, jsx_runtime_1.jsxs)("div", Object.assign({ className: `message ${m.sender}` }, { children: [m.sender === "agent" && ((0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "meta" }, { children: [(0, jsx_runtime_1.jsx)("span", { className: "dot" }), selectedModel] }))), (0, jsx_runtime_1.jsx)("div", { className: "content", dangerouslySetInnerHTML: { __html: m.text } })] }), i))) })), (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "input-bar" }, { children: [(0, jsx_runtime_1.jsx)("button", Object.assign({ className: "btn", title: "Upload image" }, { children: "\uD83D\uDCF7" })), (0, jsx_runtime_1.jsxs)("div", Object.assign({ className: "model-dropdown", onClick: (e) => {
                                            e.stopPropagation();
                                            setModelMenuOpen((o) => !o);
                                        } }, { children: [(0, jsx_runtime_1.jsx)("button", Object.assign({ className: "btn" }, { children: selectedModel })), modelMenuOpen && ((0, jsx_runtime_1.jsx)("div", Object.assign({ className: "model-menu" }, { children: [
                                                    { id: "sonnet-3.7", name: "Sonnet 3.7" },
                                                    { id: "sonnet-3.6", name: "Focus (Sonnet 3.6)" },
                                                    { id: "grok", name: "Focus (Grok)" },
                                                ].map((m) => ((0, jsx_runtime_1.jsxs)("div", Object.assign({ className: `model-item ${selectedModel === m.id ? "selected" : ""}`, onClick: () => setSelectedModel(m.id) }, { children: [(0, jsx_runtime_1.jsx)("div", { className: "radio" }), (0, jsx_runtime_1.jsx)("div", { children: m.name })] }), m.id))) })))] })), (0, jsx_runtime_1.jsx)("input", { className: "text-input", placeholder: "Describe the mobile app you want to build...", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        } }), (0, jsx_runtime_1.jsx)("button", Object.assign({ className: "send-btn", onClick: handleSend }, { children: "\u27A4" }))] }))] }))] }))] }));
}
exports.default = App;
//# sourceMappingURL=App.js.map