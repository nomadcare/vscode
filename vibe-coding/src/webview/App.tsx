import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { ThemeProvider, createGlobalStyle } from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import {
	Plus,
	Menu as MenuIcon,
	Camera,
	ChevronUp,
	ChevronDown,
	Send,
	Activity,
	Code,
} from "lucide-react";
import { theme } from "../webview/theme";

declare const acquireVsCodeApi: any;
const vscode =
	typeof acquireVsCodeApi === "function"
		? acquireVsCodeApi()
		: { postMessage: (_: any) => {} };

type Chat = {
	id: string;
	sender: "agent" | "user";
	content: React.ReactNode;
};

// Опции моделей
const modelOptions = [
	{
		id: "sonnet-3.7",
		name: "Sonnet 3.7",
		icon: Activity,
		desc: "Best model",
	},
	{
		id: "sonnet-3.6",
		name: "Focus (3.6)",
		icon: Code,
		desc: "For code and design",
	},
];

const generateId = () =>
	`${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const GlobalStyle = createGlobalStyle`
  /* сбрасываем все отступы, включительно с webview */
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
  }

  .spinner {
    animation: spin 0.4s linear infinite;
    display: inline-block;
    vertical-align: middle;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

export default function App() {
	const [chats, setChats] = useState<Chat[]>([
		{ id: generateId(), sender: "agent", content: "Привет! Чем могу помочь?" },
	]);
	const [input, setInput] = useState("");
	const [modelMenuOpen, setModelMenuOpen] = useState(false);
	const [selectedModel, setSelectedModel] = useState(modelOptions[0].id);
	const [activeFileName, setActiveFileName] = useState("");
	const chatRef = useRef<HTMLDivElement>(null);

	// Для единственного стрим-баббла
	const streamRef = useRef<{ id: string; lines: React.ReactNode[] } | null>(
		null
	);

	const scrollToBottom = () => {
		setTimeout(() => {
			chatRef.current?.scrollTo({
				top: chatRef.current.scrollHeight,
				behavior: "smooth",
			});
		}, 50);
	};

	useEffect(() => {
		vscode.postMessage({ type: "getActiveFile" });
	}, []);

	const appendMessage = useCallback(
		(sender: Chat["sender"], content: React.ReactNode) => {
			const msg = { id: generateId(), sender, content };
			setChats((prev) => [...prev, msg]);
			scrollToBottom();
		},
		[]
	);

	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const msg = e.data;
			if (!msg?.type) return;
			switch (msg.type) {
				case "activeFile":
					setActiveFileName(msg.fileName);
					break;
				case "status":
					if (
						typeof msg.message === "string" &&
						msg.message.includes("Генерация проекта")
					) {
						const id = generateId();
						streamRef.current = {
							id,
							lines: [
								<motion.div
									key="start"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
								>
									<i>{msg.message}</i>
								</motion.div>,
							],
						};
						setChats((prev) => [
							...prev,
							{
								id,
								sender: "agent",
								content: (
									<StreamBubble>{streamRef.current!.lines}</StreamBubble>
								),
							},
						]);
						scrollToBottom();
					} else {
						appendMessage("agent", <i>{msg.message}</i>);
					}
					break;
				case "fileSaved":
					if (streamRef.current) {
						const idx = streamRef.current.lines.length;
						const line = (
							<motion.div
								key={idx}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.3 }}
							>
								✅ <b>{msg.file}</b> сгенерировано и сохранено
							</motion.div>
						);
						streamRef.current.lines.push(line);
						setChats((prev) =>
							prev.map((c) =>
								c.id === streamRef.current!.id
									? {
											...c,
											content: (
												<StreamBubble>{streamRef.current!.lines}</StreamBubble>
											),
									  }
									: c
							)
						);
						scrollToBottom();
					} else {
						appendMessage(
							"agent",
							<>
								<b>✅ {msg.file}</b> сгенерировано и сохранено
							</>
						);
					}
					break;
				case "done":
					appendMessage("agent", <b>{msg.message}</b>);
					streamRef.current = null;
					break;
				case "error":
					appendMessage(
						"agent",
						<>
							<b>Ошибка:</b> {msg.message}
						</>
					);
					break;
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [appendMessage]);

	const handleSend = () => {
		if (!input.trim()) return;
		appendMessage(
			"user",
			<>
				<b>User:</b> {input}
			</>
		);
		vscode.postMessage({ type: "prompt", value: input, model: selectedModel });
		setInput("");
		setModelMenuOpen(false);
	};

	const current = modelOptions.find((o) => o.id === selectedModel)!;

	return (
		<>
			<GlobalStyle />
			<ThemeProvider theme={theme}>
				<Root>
					<Sidebar>
						<IconBtn title="New Chat">
							<Plus size={20} />
						</IconBtn>
						<IconBtn title="All Chats">
							<MenuIcon size={20} />
						</IconBtn>
					</Sidebar>
					<Main>
						<Header>
							Home Search Platform
							{activeFileName && (
								<ActiveFile>
									<GreenDot />
									{activeFileName}
								</ActiveFile>
							)}
						</Header>
						<ChatBox ref={chatRef}>
							<AnimatePresence initial={false}>
								{chats.map((m) => (
									<MsgWrapper
										key={m.id}
										as={motion.div}
										variants={msgVariants}
										initial="hidden"
										animate="visible"
										exit="hidden"
										sender={m.sender}
									>
										{m.sender === "agent" && (
											<MsgMeta>
												<Dot />
												{current.name}
											</MsgMeta>
										)}
										<Bubble sender={m.sender}>{m.content}</Bubble>
									</MsgWrapper>
								))}
							</AnimatePresence>
						</ChatBox>
						<InputWrapper>
							<InputBar>
								<MessageInput
									placeholder="Type a message…"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleSend()}
								/>
							</InputBar>
							<ButtonBar>
								<Chips>
									<ActionChip title="Upload Image">
										<Camera size={16} />
									</ActionChip>
									<ModelSelector>
										<ModelButton onClick={() => setModelMenuOpen((o) => !o)}>
											<current.icon size={16} />
											<ModelLabel>{current.name}</ModelLabel>
											{modelMenuOpen ? (
												<ChevronUp size={16} />
											) : (
												<ChevronDown size={16} />
											)}
										</ModelButton>
										{modelMenuOpen && (
											<Dropdown>
												<DropdownHeader>AI Model</DropdownHeader>
												{modelOptions.map((o) => (
													<Option
														key={o.id}
														selected={o.id === selectedModel}
														onClick={() => {
															setSelectedModel(o.id);
															setModelMenuOpen(false);
														}}
													>
														<IconWrapper>
															<o.icon size={18} />
														</IconWrapper>
														<TextGroup>
															<OptionTitle>{o.name}</OptionTitle>
															<OptionDesc>{o.desc}</OptionDesc>
														</TextGroup>
														{o.id === selectedModel && <CheckDot />}
													</Option>
												))}
											</Dropdown>
										)}
									</ModelSelector>
								</Chips>
								<Actions>
									<SendButton onClick={handleSend} title="Send">
										<Send size={18} />
									</SendButton>
								</Actions>
							</ButtonBar>
						</InputWrapper>
					</Main>
				</Root>
			</ThemeProvider>
		</>
	);
}

// Компонент для потокового пузыря без внутреннего бордера
const StreamBubble = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
	max-width: 75%;
	padding: 12px 16px;
	background: ${({ theme }) => theme.colors.bgAlt};
	border-radius: 16px;
	overflow: hidden;
`;

const msgVariants = {
	hidden: { opacity: 0, y: 10 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// Styled components: Root, Sidebar, IconBtn, Main, Header, ActiveFile, GreenDot, ChatBox, MsgWrapper,
// MsgMeta, Dot, Bubble, InputWrapper, InputBar, MessageInput, ButtonBar, Chips, ActionChip,
// ModelSelector, ModelButton, ModelLabel, Dropdown, DropdownHeader, Option, IconWrapper,
// TextGroup, OptionTitle, OptionDesc, CheckDot, Actions, SendButton
const Root = styled.div`
	display: flex;
	width: 100vw;
	height: 100vh;
	background: ${({ theme }) => theme.colors.bg};
	color: ${({ theme }) => theme.colors.fg};
	font-family: ${({ theme }) => theme.fonts.family};
	font-size: ${({ theme }) => theme.fonts.base};
`;
const Sidebar = styled.aside`
	width: ${({ theme }) => theme.sizes.sidebarWidth};
	background: ${({ theme }) => theme.colors.bgAlt};
	border-right: 1px solid ${({ theme }) => theme.colors.border};
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 16px 0;
`;
const IconBtn = styled.button`
	background: transparent;
	border: none;
	padding: 8px;
	border-radius: 8px;
	cursor: pointer;
	color: ${({ theme }) => theme.colors.fg};
	&:hover {
		background: rgba(255, 255, 255, 0.1);
		transform: scale(1.1);
	}
	transition: background 0.2s, transform 0.2s;
`;
const Main = styled.main`
	display: flex;
	flex-direction: column;
	flex: 1;
`;
const Header = styled.header`
	height: ${({ theme }) => theme.sizes.headerHeight};
	background: ${({ theme }) => theme.colors.bgAlt};
	border-bottom: 1px solid ${({ theme }) => theme.colors.border};
	display: flex;
	align-items: center;
	padding: 0 24px;
	font-weight: 600;
`;
const ActiveFile = styled.div`
	margin-left: auto;
	display: flex;
	align-items: center;
	color: #0f0;
	font-size: 14px;
`;
const GreenDot = styled.span`
	width: 8px;
	height: 8px;
	background: #0f0;
	border-radius: 50%;
	margin-right: 8px;
`;
const ChatBox = styled.div`
	flex: 1;
	overflow-y: auto;
	padding: 24px;
	display: flex;
	flex-direction: column;
	gap: 16px;
`;
const MsgWrapper = styled.div<{ sender: string }>`
	display: flex;
	flex-direction: column;
	align-items: ${({ sender }) =>
		sender === "user" ? "flex-end" : "flex-start"};
`;
const MsgMeta = styled.div`
	font-size: 12px;
	color: #999;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 4px;
`;
const Dot = styled.span`
	width: 6px;
	height: 6px;
	background: ${({ theme }) => theme.colors.accent};
	border-radius: 50%;
`;
const Bubble = styled.div<{ sender: string }>`
	max-width: 75%;
	padding: 12px 16px;
	background: ${({ sender, theme }) =>
		sender === "agent" ? theme.colors.bgAlt : theme.colors.userMsg};
	color: ${({ sender, theme }) =>
		sender === "agent" ? theme.colors.fg : theme.colors.bg};
	border: 1px solid ${({ theme }) => theme.colors.border};
	border-radius: 16px;
	line-height: 1.5;
`;
const InputWrapper = styled.div`
	margin: 16px 24px;
	background: ${({ theme }) => theme.colors.bgAlt};
	border: 1px solid ${({ theme }) => theme.colors.border};
	border-radius: 16px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;
const InputBar = styled.div`
	display: flex;
	align-items: center;
	padding: 12px 16px;
`;
const MessageInput = styled.textarea`
	flex: 1;
	padding: 12px 16px;
	border: none;
	border-radius: 12px;
	font-size: 14px;
	background: ${({ theme }) => theme.colors.bg};
	color: ${({ theme }) => theme.colors.fg};
	resize: none;
	min-height: 44px;
	line-height: 1.4;
	&:focus {
		outline: none;
	}
`;
const ButtonBar = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	border-top: 1px solid ${({ theme }) => theme.colors.border};
`;
const Chips = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	position: relative;
`;
const ActionChip = styled.button`
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 12px;
	background: ${({ theme }) => theme.colors.bg};
	color: ${({ theme }) => theme.colors.fg};
	border: 1px solid ${({ theme }) => theme.colors.border};
	border-radius: 999px;
	font-size: 14px;
	cursor: pointer;
	&:hover {
		background: rgba(255, 255, 255, 0.1);
	}
`;
const ModelSelector = styled.div`
	position: relative;
`;
const ModelButton = styled.button`
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
`;
const ModelLabel = styled.span`
	font-weight: 500;
`;
const Dropdown = styled.div`
	position: absolute;
	bottom: 100%;
	left: 0;
	margin-bottom: 6px;
	width: 260px;
	background: ${({ theme }) => theme.colors.bgAlt};
	border: 1px solid ${({ theme }) => theme.colors.border};
	border-radius: 12px;
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	overflow: hidden;
	z-index: 20;
`;
const DropdownHeader = styled.div`
	padding: 12px 16px;
	font-size: 16px;
	font-weight: 600;
	border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;
const Option = styled.div<{ selected: boolean }>`
	display: flex;
	align-items: flex-start;
	padding: 12px 16px;
	gap: 12px;
	cursor: pointer;
	background: ${({ selected }) =>
		selected ? "rgba(10,132,255,0.1)" : "transparent"};
	&:hover {
		background: rgba(255, 255, 255, 0.1);
	}
`;

const IconWrapper = styled.div`
	margin-top: 4px;
	color: ${({ theme }) => theme.colors.accent};
`;
const TextGroup = styled.div`
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 4px;
`;
const OptionTitle = styled.div`
	font-size: 15px;
	font-weight: 500;
`;
const OptionDesc = styled.div`
	font-size: 13px;
	color: #999;
`;
const CheckDot = styled.div`
	width: 8px;
	height: 8px;
	background: ${({ theme }) => theme.colors.accent};
	border-radius: 50%;
`;
const Actions = styled.div`
	display: flex;
	align-items: center;
`;
const SendButton = styled.button`
	background: ${({ theme }) => theme.colors.accent};
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
`;
