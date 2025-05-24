import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, {
	ThemeProvider,
	createGlobalStyle,
	css,
} from "styled-components";
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
	Play,
	Square,
	Trash,
	Info,
} from "lucide-react";
import { theme } from "../webview/theme";
import { supabase } from "./supabaseClient";

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

const modelOptions = [
	{ id: "sonnet-3.7", name: "Sonnet 3.7", icon: Activity, desc: "Best model" },
	{
		id: "sonnet-3.5",
		name: "Haiku 3.5",
		icon: Code,
		desc: "For code and design",
	},
];

// Mapping between UI model IDs and backend model identifiers
const modelMap: Record<string, string> = {
	"sonnet-3.7": "claude-3-7-sonnet-20250219",
	"sonnet-3.5": "claude-3-5-haiku-20241022",
};

const generateId = () =>
	`${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const GlobalStyle = createGlobalStyle`
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
  .spinner { animation: spin 0.4s linear infinite; display: inline-block; vertical-align: middle; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

export default function App() {
	// --- Auth state ---
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [user, setUser] = useState<any>(null);
	const [authError, setAuthError] = useState<string | null>(null);
	const [loadingAuth, setLoadingAuth] = useState(false);
	const [processing, setProcessing] = useState(false);

	// --- Chat state ---
	const [chats, setChats] = useState<Chat[]>([
		{
			id: generateId(),
			sender: "agent",
			content: "Hi! I’m your dedicated mobile app development agent...",
		},
	]);
	const [input, setInput] = useState("");
	const [modelMenuOpen, setModelMenuOpen] = useState(false);
	const [selectedModel, setSelectedModel] = useState(modelOptions[0].id);
	const [activeFileName, setActiveFileName] = useState("");

	const chatRef = useRef<HTMLDivElement>(null);
	const streamRef = useRef<{ id: string; lines: React.ReactNode[] } | null>(
		null
	);

	// --- Helpers ---
	const scrollToBottom = () => {
		setTimeout(() => {
			chatRef.current?.scrollTo({
				top: chatRef.current!.scrollHeight,
				behavior: "smooth",
			});
		}, 50);
	};

	/* ----------------------------------------------------------------
	 * handleSend: блокируем повторную отправку и включаем processing
	 * -------------------------------------------------------------- */
	const handleSend = () => {
		if (!input.trim() || processing) return; // <— NEW защитa от дабл-кликов
		setProcessing(true); // <— NEW
		appendMessage(
			"user",
			<>
				<b>User:</b> {input}
			</>
		);
		vscode.postMessage({
			type: "prompt",
			value: input,
			model: modelMap[selectedModel],
		});
		setInput("");
		setModelMenuOpen(false);
	};

	const appendMessage = useCallback(
		(sender: Chat["sender"], content: React.ReactNode) => {
			setChats((prev) => [...prev, { id: generateId(), sender, content }]);
			scrollToBottom();
		},
		[]
	);

	// --- Auth handlers ---
	const handleLogin = useCallback(async () => {
		setLoadingAuth(true);
		setAuthError(null);
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		setLoadingAuth(false);
		if (error) setAuthError(error.message);
		else setUser(data.session?.user || null);
	}, [email, password]);

	const handleLogout = useCallback(async () => {
		await supabase.auth.signOut();
		setUser(null);
	}, []);

	// --- Effects: auth session ---
	useEffect(() => {
		supabase.auth
			.getSession()
			.then(({ data: { session } }) => setUser(session?.user || null));
		const { data: listener } = supabase.auth.onAuthStateChange((_, session) =>
			setUser(session?.user || null)
		);
		return () => listener.subscription.unsubscribe();
	}, []);

	// --- Effects: VSCode messages ---
	useEffect(() => {
		vscode.postMessage({ type: "getActiveFile" });
	}, []);

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
						msg.message.includes("Processing")
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
								✅ <b>{msg.file}</b> saved
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
								{" "}
								<b>✅ {msg.file}</b> saved{" "}
							</>
						);
					}
					break;
				case "done":
					appendMessage("agent", <b>{msg.message}</b>);
					streamRef.current = null;
					setProcessing(false);
					break;
				case "error":
					setProcessing(false);
					appendMessage(
						"agent",
						<>
							{" "}
							<b>Ошибка:</b> {msg.message}{" "}
						</>
					);
					break;
			}
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [appendMessage]);

	const current = modelOptions.find((o) => o.id === selectedModel)!;

	// --- Render ---
	if (!user) {
		return (
			<>
				<GlobalStyle />
				<ThemeProvider theme={theme}>
					<AuthContainer>
						{authError && <ErrorText>{authError}</ErrorText>}
						<Input
							type="email"
							placeholder="Email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
						<Input
							type="password"
							placeholder="Password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
						<AuthButton onClick={handleLogin} disabled={loadingAuth}>
							{loadingAuth ? <span className="spinner">⏳</span> : "Login"}
						</AuthButton>
					</AuthContainer>
				</ThemeProvider>
			</>
		);
	}
	/* … после if (!user) { … }  */

	return (
		<>
			<GlobalStyle />
			<ThemeProvider theme={theme}>
				<Root>
					{/* ---------- ЛЕВАЯ ПАНЕЛЬ ---------- */}
					<Sidebar>
						<Tip text="Новый чат">
							<IconBtn title="New Chat">
								<Plus size={20} />
							</IconBtn>
						</Tip>

						<Tip text="Список чатов">
							<IconBtn title="All Chats">
								<MenuIcon size={20} />
							</IconBtn>
						</Tip>
					</Sidebar>

					{/* ---------- ОСНОВНАЯ ОБЛАСТЬ ---------- */}
					<Main>
						{/* ---- Хедер ---- */}
						<Header>
							Home&nbsp;Search&nbsp;Platform
							<UserInfo>
								Logged in as&nbsp;{user.email}
								<LogoutButton onClick={handleLogout}>Logout</LogoutButton>
							</UserInfo>
							{activeFileName && (
								<ActiveFile>
									<GreenDot />
									{activeFileName}
								</ActiveFile>
							)}
						</Header>

						{/* ---- Чат ---- */}
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

						{/* ---- Инпут + кнопки ---- */}
						<InputWrapper $dimmed={processing}>
							{/* затемняющий оверлей во время обработки */}
							{processing && (
								<ProcessingOverlay
									as={motion.div}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
								>
									<Spinner className="spinner" /> Processing…
								</ProcessingOverlay>
							)}

							{/* строка ввода */}
							<InputBar>
								<MessageInput
									placeholder="Type a message…"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleSend()}
									disabled={processing}
								/>
							</InputBar>

							{/* панель действий */}
							<ButtonBar>
								<Chips>
									<ActionChip title="Upload Image">
										<Camera size={16} />
									</ActionChip>

									<Tip text="Install Dependencies (npm i)">
										<ActionChip
											onClick={() =>
												vscode.postMessage({
													type: "action",
													action: "installDeps",
												})
											}
										>
											<Activity size={16} /> Install
										</ActionChip>
									</Tip>

									<Tip text="Launch Expo Dev Server">
										<ActionChip
											onClick={() =>
												vscode.postMessage({
													type: "action",
													action: "startExpo",
												})
											}
										>
											<Play size={16} /> Start
										</ActionChip>
									</Tip>

									<Tip text="Stop Expo Dev Server">
										<ActionChip
											onClick={() =>
												vscode.postMessage({
													type: "action",
													action: "stopExpo",
												})
											}
										>
											<Square size={16} /> Stop
										</ActionChip>
									</Tip>

									<Tip text="Delete node_modules folder">
										<ActionChip
											onClick={() =>
												vscode.postMessage({
													type: "action",
													action: "deleteNodeModules",
												})
											}
										>
											<Trash size={16} /> Clean&nbsp;libs
										</ActionChip>
									</Tip>

									{/* -------- Выбор модели -------- */}
									<ModelSelector>
										<Tip text="Chose ai model">
											<ModelButton onClick={() => setModelMenuOpen((o) => !o)}>
												<current.icon size={16} />
												<ModelLabel>{current.name}</ModelLabel>
												{modelMenuOpen ? (
													<ChevronUp size={16} />
												) : (
													<ChevronDown size={16} />
												)}
											</ModelButton>
										</Tip>

										{modelMenuOpen && (
											<Dropdown
												as={motion.div}
												initial={{ opacity: 0, y: 4 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 4 }}
											>
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

								{/* ---- кнопка Send ---- */}
								<Actions>
									<SendButton
										onClick={handleSend}
										title="Send"
										disabled={processing}
									>
										{processing ? (
											<Spinner className="spinner" />
										) : (
											<Send size={18} />
										)}
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

// Styled components
/* ------------------------------------------------------------------ */
/* 3. Tooltip компонент + стили                                       */
/* ------------------------------------------------------------------ */
const Tip: React.FC<{ text: string; children: React.ReactNode }> = ({
	text,
	children,
}) => {
	const [open, setOpen] = useState(false);
	return (
		<TipWrap
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
			onFocus={() => setOpen(true)}
			onBlur={() => setOpen(false)}
		>
			{children}
			<AnimatePresence>
				{open && (
					<TipBubble
						as={motion.div}
						initial={{ opacity: 0, y: 4, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 4, scale: 0.95 }}
						transition={{ type: "spring", stiffness: 350, damping: 25 }}
					>
						{text}
					</TipBubble>
				)}
			</AnimatePresence>
		</TipWrap>
	);
};

const TipWrap = styled.span`
	position: relative;
	display: inline-block; /* чтобы ширина = ширина кнопки */
`;

const TipBubble = styled.div`
	position: absolute;
	bottom: 100%; /* выровняли верх пузыря по верху TipWrap */
	left: 0%; /* точка отсчёта — середина TipWrap */
	margin-bottom: 8px; /* отступ над кнопкой */
	transform: translateX(
		-50%
	); /* сдвигаем назад на половину ширины самого пузыря */
	white-space: nowrap;
	padding: 6px 10px;
	font-size: 13px;
	font-weight: 500;
	background: ${({ theme }) => theme.colors.fg};
	color: ${({ theme }) => theme.colors.bg};
	border-radius: 8px;
	pointer-events: none;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
	z-index: 50;
`;

const Spinner = styled(Info)`
	/* минимальный спиннер-иконка */
	animation: spin 0.8s linear infinite;
`;

const ProcessingOverlay = styled.div`
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	font-size: 15px;
	font-weight: 500;
	background: rgba(0, 0, 0, 0.25);
	color: #fff;
	backdrop-filter: blur(4px);
	border-radius: 16px;
`;

const AuthContainer = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100vh;
	background: ${({ theme }) => theme.colors.bg};
	color: ${({ theme }) => theme.colors.fg};
`;
const Input = styled.input`
	width: 280px;
	margin: 8px 0;
	padding: 10px;
	background: ${({ theme }) => theme.colors.bgAlt};
	color: ${({ theme }) => theme.colors.fg};
	border: 1px solid ${({ theme }) => theme.colors.border};
	border-radius: 8px;
`;
const AuthButton = styled.button`
	margin-top: 12px;
	padding: 10px 20px;
	background: ${({ theme }) => theme.colors.accent};
	color: #fff;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	&:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;
const ErrorText = styled.p`
	color: #f00;
	margin-bottom: 8px;
`;
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
const InputWrapper = styled.div<{ $dimmed?: boolean }>`
	margin: 16px 24px;
	background: ${({ theme }) => theme.colors.bgAlt};
	border: 1px solid ${({ theme }) => theme.colors.border};
	border-radius: 16px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	position: relative;

	/* опционально: визуально «гасим» блок во время обработки */
	${({ $dimmed }) =>
		$dimmed &&
		css`
			opacity: 0.6;
			pointer-events: none;
		`}
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

// Styled components definitions
const UserInfo = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	margin-left: auto;
	font-size: 14px;
`;

const LogoutButton = styled.button`
	padding: 6px 12px;
	background: ${({ theme }) => "#e00"};
	color: #fff;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	&:hover {
		opacity: 0.8;
	}
`;
