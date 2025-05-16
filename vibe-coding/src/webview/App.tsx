// import React, { useEffect, useState, useRef, useCallback } from "react";
// import styled, { ThemeProvider } from "styled-components";
// import { motion, AnimatePresence } from "framer-motion";
// import {
// 	Plus,
// 	Menu as MenuIcon,
// 	Camera,
// 	ChevronUp,
// 	ChevronDown,
// 	Send,
// 	Activity,
// 	Code,
// 	Layout,
// } from "lucide-react";
// import { theme } from "../webview/theme";

// declare const acquireVsCodeApi: any;
// const vscode = acquireVsCodeApi();

// type Chat = { sender: "agent" | "user"; text: string };
// const modelOptions = [
// 	{
// 		id: "sonnet-3.7",
// 		name: "Sonnet 3.7",
// 		icon: Activity,
// 		desc: "Best model, but can do things you didn't ask for",
// 	},
// 	{
// 		id: "sonnet-3.6",
// 		name: "Focus (3.6)",
// 		icon: Code,
// 		desc: "Good at coding and design",
// 	},
// 	{
// 		id: "grok",
// 		name: "Focus (Grok)",
// 		icon: Layout,
// 		desc: "Great at coding, but not so good at design",
// 	},
// ];

// export default function App() {
// 	const [chats, setChats] = useState<Chat[]>([
// 		{ sender: "agent", text: "Hello! How can I help you today?" },
// 	]);
// 	const [input, setInput] = useState("");
// 	const [modelMenuOpen, setModelMenuOpen] = useState(false);
// 	const [selectedModel, setSelectedModel] = useState<string>(
// 		modelOptions[0].id
// 	);
// 	const [activeFileName, setActiveFileName] = useState("");
// 	const chatRef = useRef<HTMLDivElement>(null);
// 	const selectorRef = useRef<HTMLDivElement>(null);

// 	useEffect(() => {
// 		vscode.postMessage({ type: "getActiveFile" });
// 		const handle = (e: MessageEvent) => {
// 			const msg = e.data;
// 			if (msg.type === "activeFile") setActiveFileName(msg.fileName);
// 			if (msg.type === "simulateResponse") appendMessage("agent", msg.code);
// 		};
// 		window.addEventListener("message", handle);
// 		return () => window.removeEventListener("message", handle);
// 	}, []);

// 	// Close dropdown on outside click
// 	useEffect(() => {
// 		const onClickOutside = (e: MouseEvent) => {
// 			if (
// 				selectorRef.current &&
// 				!selectorRef.current.contains(e.target as Node)
// 			) {
// 				setModelMenuOpen(false);
// 			}
// 		};
// 		if (modelMenuOpen) document.addEventListener("mousedown", onClickOutside);
// 		return () => document.removeEventListener("mousedown", onClickOutside);
// 	}, [modelMenuOpen]);

// 	const appendMessage = useCallback((sender: Chat["sender"], text: string) => {
// 		setChats((prev) => [...prev, { sender, text }]);
// 		setTimeout(
// 			() =>
// 				chatRef.current?.scrollTo({
// 					top: chatRef.current.scrollHeight,
// 					behavior: "smooth",
// 				}),
// 			50
// 		);
// 	}, []);

// 	const handleSend = useCallback(() => {
// 		if (!input.trim()) return;
// 		appendMessage("user", input);
// 		vscode.postMessage({
// 			type: "simulate",
// 			prompt: input,
// 			model: selectedModel,
// 		});
// 		setInput("");
// 		setModelMenuOpen(false);
// 	}, [input, selectedModel, appendMessage]);

// 	const current = modelOptions.find((opt) => opt.id === selectedModel)!;

// 	return (
// 		<ThemeProvider theme={theme}>
// 			<Root>
// 				<Sidebar>
// 					<IconBtn title="New Chat">
// 						<Plus size={20} />
// 					</IconBtn>
// 					<IconBtn title="All Chats">
// 						<MenuIcon size={20} />
// 					</IconBtn>
// 				</Sidebar>

// 				<Main>
// 					<Header>
// 						Home Search Platform
// 						{activeFileName && (
// 							<ActiveFile>
// 								<GreenDot />
// 								{activeFileName}
// 							</ActiveFile>
// 						)}
// 					</Header>

// 					<ChatBox ref={chatRef}>
// 						<AnimatePresence initial={false}>
// 							{chats.map((msg, i) => (
// 								<MsgWrapper
// 									key={i}
// 									as={motion.div}
// 									variants={msgVariants}
// 									initial="hidden"
// 									animate="visible"
// 									exit="hidden"
// 									sender={msg.sender}
// 								>
// 									{msg.sender === "agent" && (
// 										<MsgMeta>
// 											<Dot />
// 											{current.name}
// 										</MsgMeta>
// 									)}
// 									<Bubble
// 										sender={msg.sender}
// 										dangerouslySetInnerHTML={{ __html: msg.text }}
// 									/>
// 								</MsgWrapper>
// 							))}
// 						</AnimatePresence>
// 					</ChatBox>

// 					<InputWrapper>
// 						<InputBar>
// 							<MessageInput
// 								placeholder="Type a message..."
// 								value={input}
// 								onChange={(e) => setInput(e.target.value)}
// 								onKeyDown={(e) => e.key === "Enter" && handleSend()}
// 							/>
// 						</InputBar>

// 						<ButtonBar>
// 							<Chips ref={selectorRef}>
// 								<ActionChip title="Upload Image">
// 									<Camera size={16} />
// 								</ActionChip>
// 								<ModelSelector>
// 									<ModelButton
// 										onClick={() => setModelMenuOpen((open) => !open)}
// 									>
// 										<current.icon size={16} />
// 										<ModelLabel>{current.name}</ModelLabel>
// 										{modelMenuOpen ? (
// 											<ChevronUp size={16} />
// 										) : (
// 											<ChevronDown size={16} />
// 										)}
// 									</ModelButton>
// 									{modelMenuOpen && (
// 										<Dropdown>
// 											<DropdownHeader>AI Model</DropdownHeader>
// 											{modelOptions.map((opt) => (
// 												<Option
// 													key={opt.id}
// 													selected={opt.id === selectedModel}
// 													onClick={() => {
// 														setSelectedModel(opt.id);
// 														setModelMenuOpen(false);
// 													}}
// 												>
// 													<IconWrapper>
// 														<opt.icon size={18} />
// 													</IconWrapper>
// 													<TextGroup>
// 														<OptionTitle>{opt.name}</OptionTitle>
// 														<OptionDesc>{opt.desc}</OptionDesc>
// 													</TextGroup>
// 													{opt.id === selectedModel && <CheckDot />}
// 												</Option>
// 											))}
// 										</Dropdown>
// 									)}
// 								</ModelSelector>
// 							</Chips>
// 							<Actions>
// 								<SendButton onClick={handleSend} title="Send">
// 									<Send size={18} />
// 								</SendButton>
// 							</Actions>
// 						</ButtonBar>
// 					</InputWrapper>
// 				</Main>
// 			</Root>
// 		</ThemeProvider>
// 	);
// }

// // Variants
// const msgVariants = {
// 	hidden: { opacity: 0, y: 10 },
// 	visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
// };

// // Styled
// const Root = styled.div`
// 	display: flex;
// 	width: 100vw;
// 	height: 100vh;
// 	background: ${(p) => p.theme.colors.bg};
// 	color: ${(p) => p.theme.colors.fg};
// 	font-family: ${(p) => p.theme.fonts.family};
// 	font-size: ${(p) => p.theme.fonts.base};
// `;
// const Sidebar = styled.aside`
// 	width: ${(p) => p.theme.sizes.sidebarWidth};
// 	background: ${(p) => p.theme.colors.bgAlt};
// 	border-right: 1px solid ${(p) => p.theme.colors.border};
// 	display: flex;
// 	flex-direction: column;
// 	align-items: center;
// 	padding: 16px 0;
// `;
// const IconBtn = styled.button`
// 	background: transparent;
// 	border: none;
// 	padding: 8px;
// 	border-radius: 8px;
// 	cursor: pointer;
// 	color: ${(p) => p.theme.colors.fg};
// 	&:hover {
// 		background: rgba(255, 255, 255, 0.1);
// 		transform: scale(1.1);
// 	}
// 	transition: background 0.2s, transform 0.2s;
// `;
// const Main = styled.main`
// 	display: flex;
// 	flex-direction: column;
// 	flex: 1;
// `;
// const Header = styled.header`
// 	height: ${(p) => p.theme.sizes.headerHeight};
// 	background: ${(p) => p.theme.colors.bgAlt};
// 	border-bottom: 1px solid ${(p) => p.theme.colors.border};
// 	display: flex;
// 	align-items: center;
// 	padding: 0 24px;
// 	font-weight: 600;
// `;
// const ActiveFile = styled.div`
// 	margin-left: auto;
// 	display: flex;
// 	align-items: center;
// 	color: #0f0;
// 	font-size: 14px;
// `;
// const GreenDot = styled.span`
// 	width: 8px;
// 	height: 8px;
// 	background: #0f0;
// 	border-radius: 50%;
// 	margin-right: 8px;
// `;
// const ChatBox = styled.div`
// 	flex: 1;
// 	overflow-y: auto;
// 	padding: 24px;
// 	display: flex;
// 	flex-direction: column;
// 	gap: 16px;
// `;
// const MsgWrapper = styled.div<{ sender: string }>`
// 	display: flex;
// 	flex-direction: column;
// 	align-items: ${(p) => (p.sender === "user" ? "flex-end" : "flex-start")};
// `;
// const MsgMeta = styled.div`
// 	font-size: 12px;
// 	color: #999;
// 	display: inline-flex;
// 	align-items: center;
// 	gap: 6px;
// 	margin-bottom: 4px;
// `;
// const Dot = styled.span`
// 	width: 6px;
// 	height: 6px;
// 	background: ${(p) => p.theme.colors.accent};
// 	border-radius: 50%;
// `;
// const Bubble = styled.div<{ sender: string }>`
// 	max-width: 75%;
// 	padding: 12px 16px;
// 	background: ${(p) =>
// 		p.sender === "agent" ? p.theme.colors.bgAlt : p.theme.colors.userMsg};
// 	color: ${(p) =>
// 		p.sender === "agent" ? p.theme.colors.fg : p.theme.colors.bg};
// 	border: 1px solid ${(p) => p.theme.colors.border};
// 	border-radius: 16px;
// 	line-height: 1.5;
// `;
// const InputWrapper = styled.div`
// 	margin: 16px 24px;
// 	background: ${(p) => p.theme.colors.bgAlt};
// 	border: 1px solid ${(p) => p.theme.colors.border};
// 	border-radius: 16px;
// 	overflow: visible;
// 	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
// `;
// const InputBar = styled.div`
// 	display: flex;
// 	align-items: center;
// 	padding: 12px 16px;
// `;
// const MessageInput = styled.textarea`
// 	flex: 1;
// 	padding: 12px 16px;
// 	border: none;
// 	border-radius: 12px;
// 	font-size: 14px;
// 	background: ${(p) => p.theme.colors.bg};
// 	color: ${(p) => p.theme.colors.fg};
// 	resize: none;
// 	min-height: 44px;
// 	line-height: 1.4;
// 	&:focus {
// 		outline: none;
// 	}
// `;
// const ButtonBar = styled.div`
// 	display: flex;
// 	justify-content: space-between;
// 	align-items: center;
// 	padding: 12px 16px;
// 	border-top: 1px solid ${(p) => p.theme.colors.border};
// `;
// const Chips = styled.div`
// 	display: flex;
// 	align-items: center;
// 	gap: 12px;
// 	position: relative;
// `;
// const ActionChip = styled.button`
// 	display: flex;
// 	align-items: center;
// 	gap: 6px;
// 	padding: 8px 12px;
// 	background: ${(p) => p.theme.colors.bg};
// 	color: ${(p) => p.theme.colors.fg};
// 	border: 1px solid ${(p) => p.theme.colors.border};
// 	border-radius: 999px;
// 	font-size: 14px;
// 	cursor: pointer;
// 	&:hover {
// 		background: rgba(255, 255, 255, 0.1);
// 	}
// 	transition: background 0.2s;
// `;
// const ModelSelector = styled.div`
// 	position: relative;
// `;
// const ModelButton = styled.button`
// 	display: flex;
// 	align-items: center;
// 	gap: 8px;
// 	padding: 8px 12px;
// 	background: #000;
// 	color: #fff;
// 	border: 1px solid #222;
// 	border-radius: 999px;
// 	font-size: 14px;
// 	cursor: pointer;
// 	&:hover {
// 		background: #111;
// 	}
// 	transition: background 0.2s;
// `;
// const ModelLabel = styled.span`
// 	font-weight: 500;
// `;
// const Dropdown = styled.div`
// 	position: absolute;
// 	bottom: 100%;
// 	left: 0;
// 	margin-bottom: 6px;
// 	width: 260px;
// 	background: ${(p) => p.theme.colors.bgAlt};
// 	border: 1px solid ${(p) => p.theme.colors.border};
// 	border-radius: 12px;
// 	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
// 	overflow: hidden;
// 	z-index: 20;
// `;
// const DropdownHeader = styled.div`
// 	padding: 12px 16px;
// 	font-size: 16px;
// 	font-weight: 600;
// 	border-bottom: 1px solid ${(p) => p.theme.colors.border};
// `;
// const Option = styled.div<{ selected: boolean }>`
// 	display: flex;
// 	align-items: flex-start;
// 	padding: 12px 16px;
// 	gap: 12px;
// 	cursor: pointer;
// 	background: ${(p) => (p.selected ? "rgba(10,132,255,0.1)" : "transparent")};
// 	&:hover {
// 		background: rgba(255, 255, 255, 0.1);
// 	}
// 	transition: background 0.2s;
// `;
// const IconWrapper = styled.div`
// 	margin-top: 4px;
// 	color: ${(p) => p.theme.colors.accent};
// `;
// const TextGroup = styled.div`
// 	flex: 1;
// 	display: flex;
// 	flex-direction: column;
// 	gap: 4px;
// `;
// const OptionTitle = styled.div`
// 	font-size: 15px;
// 	font-weight: 500;
// `;
// const OptionDesc = styled.div`
// 	font-size: 13px;
// 	color: #999;
// `;
// const CheckDot = styled.div`
// 	width: 8px;
// 	height: 8px;
// 	background: ${(p) => p.theme.colors.accent};
// 	border-radius: 50%;
// 	margin-top: 6px;
// `;
// const Actions = styled.div`
// 	display: flex;
// 	align-items: center;
// `;
// const SendButton = styled.button`
// 	background: ${(p) => p.theme.colors.accent};
// 	border: none;
// 	width: 44px;
// 	height: 44px;
// 	border-radius: 50%;
// 	display: flex;
// 	align-items: center;
// 	justify-content: center;
// 	cursor: pointer;
// 	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
// 	&:hover {
// 		transform: scale(1.1);
// 		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
// 	}
// 	transition: transform 0.2s, box-shadow 0.2s;
// `;

import * as React from "react";
import { useState, useEffect, useRef } from "react";

// Попытка получить VS Code API (только внутри WebView)
let vscode: { postMessage: (msg: any) => void };

if (typeof (window as any).acquireVsCodeApi === "function") {
	// WebView context: получаем настоящий API
	vscode = (window as any).acquireVsCodeApi();
} else {
	// Не WebView (локальная разработка, стороний браузер и т.п.)
	// — делаем заглушку, чтобы postMessage() был безопасен
	vscode = { postMessage: () => {} };
}

const App: React.FC = () => {
	const [prompt, setPrompt] = useState<string>(""); // Ввод пользователя
	const [logs, setLogs] = useState<string[]>([]); // Лог событий

	const logEndRef = useRef<HTMLDivElement>(null);

	// Автопрокрутка вниз при добавлении нового лога
	useEffect(() => {
		logEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [logs]);

	// Функция добавления строки в лог
	const appendLog = (message: string) => {
		setLogs((prev) => [...prev, message]);
	};

	// Отправка промпта в расширение
	const sendPrompt = () => {
		if (!prompt.trim()) return;
		appendLog(`> **User:** ${prompt}`);
		vscode.postMessage({ type: "prompt", value: prompt });
		setPrompt("");
	};

	// Обработка сообщений из расширения
	useEffect(() => {
		const handler = (event: MessageEvent<any>) => {
			const message = event.data as { type: string; [key: string]: any };
			if (!message || !message.type) return;

			switch (message.type) {
				case "status":
					appendLog(`*${message.message}*`);
					break;
				case "partial":
					appendLog(message.content);
					break;
				case "fileStart":
					appendLog(`**Генерация файла ${message.file}...**`);
					break;
				case "fileContent":
					appendLog(message.content);
					break;
				case "fileEnd":
					appendLog(`✅ Файл *${message.file}* сгенерирован`);
					break;
				case "fileSaved":
					appendLog(`💾 Файл *${message.file}* сохранен`);
					break;
				case "done":
					appendLog(`**${message.message}**`);
					break;
				case "error":
					appendLog(`**Ошибка:** ${message.message}`);
					break;
			}
		};

		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []);

	return (
		<div
			style={{
				fontFamily: "sans-serif",
				padding: "1rem",
				color: "#cccccc",
				backgroundColor: "#1e1e1e",
			}}
		>
			{/* Форма ввода промпта */}
			<div style={{ marginBottom: "0.5rem" }}>
				<input
					type="text"
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") sendPrompt();
					}}
					placeholder="Опишите, какое Expo-приложение создать..."
					style={{ width: "80%", marginRight: "0.5rem" }}
				/>
				<button onClick={sendPrompt}>Создать</button>
			</div>

			{/* Область логов */}
			<div
				style={{
					backgroundColor: "#252526",
					padding: "1rem",
					borderRadius: "4px",
					maxHeight: "60vh",
					overflowY: "auto",
					whiteSpace: "pre-wrap",
				}}
			>
				{logs.map((line, idx) => (
					<div key={idx} dangerouslySetInnerHTML={{ __html: line }} />
				))}
				<div ref={logEndRef} />
			</div>
		</div>
	);
};

export default App;
