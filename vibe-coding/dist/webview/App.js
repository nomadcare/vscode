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
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const styled_components_1 = __importStar(require("styled-components"));
const framer_motion_1 = require("framer-motion");
const lucide_react_1 = require("lucide-react");
const theme_1 = require("../webview/theme");
const vscode = acquireVsCodeApi();
const modelOptions = [
    {
        id: "sonnet-3.7",
        name: "Sonnet 3.7",
        icon: lucide_react_1.Activity,
        desc: "Best model, but can do things you didn't ask for",
    },
    {
        id: "sonnet-3.6",
        name: "Focus (3.6)",
        icon: lucide_react_1.Code,
        desc: "Good at coding and design",
    },
    {
        id: "grok",
        name: "Focus (Grok)",
        icon: lucide_react_1.Layout,
        desc: "Great at coding, but not so good at design",
    },
];
function App() {
    const [chats, setChats] = (0, react_1.useState)([
        { sender: "agent", text: "Hello! How can I help you today?" },
    ]);
    const [input, setInput] = (0, react_1.useState)("");
    const [modelMenuOpen, setModelMenuOpen] = (0, react_1.useState)(false);
    const [selectedModel, setSelectedModel] = (0, react_1.useState)(modelOptions[0].id);
    const [activeFileName, setActiveFileName] = (0, react_1.useState)("");
    const chatRef = (0, react_1.useRef)(null);
    const selectorRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        vscode.postMessage({ type: "getActiveFile" });
        const handle = (e) => {
            const msg = e.data;
            if (msg.type === "activeFile")
                setActiveFileName(msg.fileName);
            if (msg.type === "simulateResponse")
                appendMessage("agent", msg.code);
        };
        window.addEventListener("message", handle);
        return () => window.removeEventListener("message", handle);
    }, []);
    // Close dropdown on outside click
    (0, react_1.useEffect)(() => {
        const onClickOutside = (e) => {
            if (selectorRef.current &&
                !selectorRef.current.contains(e.target)) {
                setModelMenuOpen(false);
            }
        };
        if (modelMenuOpen)
            document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [modelMenuOpen]);
    const appendMessage = (0, react_1.useCallback)((sender, text) => {
        setChats((prev) => [...prev, { sender, text }]);
        setTimeout(() => {
            var _a;
            return (_a = chatRef.current) === null || _a === void 0 ? void 0 : _a.scrollTo({
                top: chatRef.current.scrollHeight,
                behavior: "smooth",
            });
        }, 50);
    }, []);
    const handleSend = (0, react_1.useCallback)(() => {
        if (!input.trim())
            return;
        appendMessage("user", input);
        vscode.postMessage({
            type: "simulate",
            prompt: input,
            model: selectedModel,
        });
        setInput("");
        setModelMenuOpen(false);
    }, [input, selectedModel, appendMessage]);
    const current = modelOptions.find((opt) => opt.id === selectedModel);
    return ((0, jsx_runtime_1.jsx)(styled_components_1.ThemeProvider, Object.assign({ theme: theme_1.theme }, { children: (0, jsx_runtime_1.jsxs)(Root, { children: [(0, jsx_runtime_1.jsxs)(Sidebar, { children: [(0, jsx_runtime_1.jsx)(IconBtn, Object.assign({ title: "New Chat" }, { children: (0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { size: 20 }) })), (0, jsx_runtime_1.jsx)(IconBtn, Object.assign({ title: "All Chats" }, { children: (0, jsx_runtime_1.jsx)(lucide_react_1.Menu, { size: 20 }) }))] }), (0, jsx_runtime_1.jsxs)(Main, { children: [(0, jsx_runtime_1.jsxs)(Header, { children: ["Home Search Platform", activeFileName && ((0, jsx_runtime_1.jsxs)(ActiveFile, { children: [(0, jsx_runtime_1.jsx)(GreenDot, {}), activeFileName] }))] }), (0, jsx_runtime_1.jsx)(ChatBox, Object.assign({ ref: chatRef }, { children: (0, jsx_runtime_1.jsx)(framer_motion_1.AnimatePresence, Object.assign({ initial: false }, { children: chats.map((msg, i) => ((0, jsx_runtime_1.jsxs)(MsgWrapper, Object.assign({ as: framer_motion_1.motion.div, variants: msgVariants, initial: "hidden", animate: "visible", exit: "hidden", sender: msg.sender }, { children: [msg.sender === "agent" && ((0, jsx_runtime_1.jsxs)(MsgMeta, { children: [(0, jsx_runtime_1.jsx)(Dot, {}), current.name] })), (0, jsx_runtime_1.jsx)(Bubble, { sender: msg.sender, dangerouslySetInnerHTML: { __html: msg.text } })] }), i))) })) })), (0, jsx_runtime_1.jsxs)(InputWrapper, { children: [(0, jsx_runtime_1.jsx)(InputBar, { children: (0, jsx_runtime_1.jsx)(MessageInput, { placeholder: "Type a message...", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => e.key === "Enter" && handleSend() }) }), (0, jsx_runtime_1.jsxs)(ButtonBar, { children: [(0, jsx_runtime_1.jsxs)(Chips, Object.assign({ ref: selectorRef }, { children: [(0, jsx_runtime_1.jsx)(ActionChip, Object.assign({ title: "Upload Image" }, { children: (0, jsx_runtime_1.jsx)(lucide_react_1.Camera, { size: 16 }) })), (0, jsx_runtime_1.jsxs)(ModelSelector, { children: [(0, jsx_runtime_1.jsxs)(ModelButton, Object.assign({ onClick: () => setModelMenuOpen((open) => !open) }, { children: [(0, jsx_runtime_1.jsx)(current.icon, { size: 16 }), (0, jsx_runtime_1.jsx)(ModelLabel, { children: current.name }), modelMenuOpen ? ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronUp, { size: 16 })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { size: 16 }))] })), modelMenuOpen && ((0, jsx_runtime_1.jsxs)(Dropdown, { children: [(0, jsx_runtime_1.jsx)(DropdownHeader, { children: "AI Model" }), modelOptions.map((opt) => ((0, jsx_runtime_1.jsxs)(Option, Object.assign({ selected: opt.id === selectedModel, onClick: () => {
                                                                        setSelectedModel(opt.id);
                                                                        setModelMenuOpen(false);
                                                                    } }, { children: [(0, jsx_runtime_1.jsx)(IconWrapper, { children: (0, jsx_runtime_1.jsx)(opt.icon, { size: 18 }) }), (0, jsx_runtime_1.jsxs)(TextGroup, { children: [(0, jsx_runtime_1.jsx)(OptionTitle, { children: opt.name }), (0, jsx_runtime_1.jsx)(OptionDesc, { children: opt.desc })] }), opt.id === selectedModel && (0, jsx_runtime_1.jsx)(CheckDot, {})] }), opt.id)))] }))] })] })), (0, jsx_runtime_1.jsx)(Actions, { children: (0, jsx_runtime_1.jsx)(SendButton, Object.assign({ onClick: handleSend, title: "Send" }, { children: (0, jsx_runtime_1.jsx)(lucide_react_1.Send, { size: 18 }) })) })] })] })] })] }) })));
}
exports.default = App;
// Variants
const msgVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};
// Styled
const Root = styled_components_1.default.div `
	display: flex;
	width: 100vw;
	height: 100vh;
	background: ${(p) => p.theme.colors.bg};
	color: ${(p) => p.theme.colors.fg};
	font-family: ${(p) => p.theme.fonts.family};
	font-size: ${(p) => p.theme.fonts.base};
`;
const Sidebar = styled_components_1.default.aside `
	width: ${(p) => p.theme.sizes.sidebarWidth};
	background: ${(p) => p.theme.colors.bgAlt};
	border-right: 1px solid ${(p) => p.theme.colors.border};
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 16px 0;
`;
const IconBtn = styled_components_1.default.button `
	background: transparent;
	border: none;
	padding: 8px;
	border-radius: 8px;
	cursor: pointer;
	color: ${(p) => p.theme.colors.fg};
	&:hover {
		background: rgba(255, 255, 255, 0.1);
		transform: scale(1.1);
	}
	transition: background 0.2s, transform 0.2s;
`;
const Main = styled_components_1.default.main `
	display: flex;
	flex-direction: column;
	flex: 1;
`;
const Header = styled_components_1.default.header `
	height: ${(p) => p.theme.sizes.headerHeight};
	background: ${(p) => p.theme.colors.bgAlt};
	border-bottom: 1px solid ${(p) => p.theme.colors.border};
	display: flex;
	align-items: center;
	padding: 0 24px;
	font-weight: 600;
`;
const ActiveFile = styled_components_1.default.div `
	margin-left: auto;
	display: flex;
	align-items: center;
	color: #0f0;
	font-size: 14px;
`;
const GreenDot = styled_components_1.default.span `
	width: 8px;
	height: 8px;
	background: #0f0;
	border-radius: 50%;
	margin-right: 8px;
`;
const ChatBox = styled_components_1.default.div `
	flex: 1;
	overflow-y: auto;
	padding: 24px;
	display: flex;
	flex-direction: column;
	gap: 16px;
`;
const MsgWrapper = styled_components_1.default.div `
	display: flex;
	flex-direction: column;
	align-items: ${(p) => (p.sender === "user" ? "flex-end" : "flex-start")};
`;
const MsgMeta = styled_components_1.default.div `
	font-size: 12px;
	color: #999;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 4px;
`;
const Dot = styled_components_1.default.span `
	width: 6px;
	height: 6px;
	background: ${(p) => p.theme.colors.accent};
	border-radius: 50%;
`;
const Bubble = styled_components_1.default.div `
	max-width: 75%;
	padding: 12px 16px;
	background: ${(p) => p.sender === "agent" ? p.theme.colors.bgAlt : p.theme.colors.userMsg};
	color: ${(p) => p.sender === "agent" ? p.theme.colors.fg : p.theme.colors.bg};
	border: 1px solid ${(p) => p.theme.colors.border};
	border-radius: 16px;
	line-height: 1.5;
`;
const InputWrapper = styled_components_1.default.div `
	margin: 16px 24px;
	background: ${(p) => p.theme.colors.bgAlt};
	border: 1px solid ${(p) => p.theme.colors.border};
	border-radius: 16px;
	overflow: visible;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;
const InputBar = styled_components_1.default.div `
	display: flex;
	align-items: center;
	padding: 12px 16px;
`;
const MessageInput = styled_components_1.default.textarea `
	flex: 1;
	padding: 12px 16px;
	border: none;
	border-radius: 12px;
	font-size: 14px;
	background: ${(p) => p.theme.colors.bg};
	color: ${(p) => p.theme.colors.fg};
	resize: none;
	min-height: 44px;
	line-height: 1.4;
	&:focus {
		outline: none;
	}
`;
const ButtonBar = styled_components_1.default.div `
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	border-top: 1px solid ${(p) => p.theme.colors.border};
`;
const Chips = styled_components_1.default.div `
	display: flex;
	align-items: center;
	gap: 12px;
	position: relative;
`;
const ActionChip = styled_components_1.default.button `
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 12px;
	background: ${(p) => p.theme.colors.bg};
	color: ${(p) => p.theme.colors.fg};
	border: 1px solid ${(p) => p.theme.colors.border};
	border-radius: 999px;
	font-size: 14px;
	cursor: pointer;
	&:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	transition: background 0.2s;
`;
const ModelSelector = styled_components_1.default.div `
	position: relative;
`;
const ModelButton = styled_components_1.default.button `
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	background: #000;
	color: #fff;
	border: 1px solid #222;
	border-radius: 999px;
	font-size: 14px;
	cursor: pointer;
	&:hover {
		background: #111;
	}
	transition: background 0.2s;
`;
const ModelLabel = styled_components_1.default.span `
	font-weight: 500;
`;
const Dropdown = styled_components_1.default.div `
	position: absolute;
	bottom: 100%;
	left: 0;
	margin-bottom: 6px;
	width: 260px;
	background: ${(p) => p.theme.colors.bgAlt};
	border: 1px solid ${(p) => p.theme.colors.border};
	border-radius: 12px;
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	overflow: hidden;
	z-index: 20;
`;
const DropdownHeader = styled_components_1.default.div `
	padding: 12px 16px;
	font-size: 16px;
	font-weight: 600;
	border-bottom: 1px solid ${(p) => p.theme.colors.border};
`;
const Option = styled_components_1.default.div `
	display: flex;
	align-items: flex-start;
	padding: 12px 16px;
	gap: 12px;
	cursor: pointer;
	background: ${(p) => (p.selected ? "rgba(10,132,255,0.1)" : "transparent")};
	&:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	transition: background 0.2s;
`;
const IconWrapper = styled_components_1.default.div `
	margin-top: 4px;
	color: ${(p) => p.theme.colors.accent};
`;
const TextGroup = styled_components_1.default.div `
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 4px;
`;
const OptionTitle = styled_components_1.default.div `
	font-size: 15px;
	font-weight: 500;
`;
const OptionDesc = styled_components_1.default.div `
	font-size: 13px;
	color: #999;
`;
const CheckDot = styled_components_1.default.div `
	width: 8px;
	height: 8px;
	background: ${(p) => p.theme.colors.accent};
	border-radius: 50%;
	margin-top: 6px;
`;
const Actions = styled_components_1.default.div `
	display: flex;
	align-items: center;
`;
const SendButton = styled_components_1.default.button `
	background: ${(p) => p.theme.colors.accent};
	border: none;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	&:hover {
		transform: scale(1.1);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
	}
	transition: transform 0.2s, box-shadow 0.2s;
`;
//# sourceMappingURL=App.js.map