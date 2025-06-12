/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, {
	ThemeProvider,
	createGlobalStyle,
	css,
} from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import {
	Plus,
	Camera,
	ChevronDown,
	ChevronUp,
	Send,
	Activity,
	Code,
	Play,
	Square,
	Trash,
	Sun,
	Moon,
	Info,
	Lock,
	Upload,
	Link as LinkIcon,
	ExternalLink,
	Apple,
	Store,
} from "lucide-react";
import { theme as baseTheme } from "../webview/theme";
import { supabase } from "./supabaseClient";

/* ---------------- VS Code bridge ---------------- */
declare const acquireVsCodeApi: any;
const vscode: {
	postMessage: (m: any) => void;
	getState?: () => any;
	setState?: (s: any) => void;
} =
	typeof acquireVsCodeApi === "function"
		? acquireVsCodeApi()
		: { postMessage: () => {} };

/* ---------------- helpers / consts ---------------- */
interface Chat {
	id: string;
	sender: "agent" | "user";
	content: React.ReactNode;
}
const modelOptions = [
	{ id: "sonnet-4", name: "Sonnet 4", icon: Activity, desc: "Best model" },
	{
		id: "sonnet-3.5",
		name: "Haiku 3.5",
		icon: Code,
		desc: "For code & design",
	},
];
const modelMap: Record<string, string> = {
	"sonnet-4": "claude-sonnet-4-20250514",
	"sonnet-3.5": "claude-3-5-haiku-20241022",
};
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/* ---- themes ---- */
const light = {
	bg: "#fff",
	bgAlt: "#f5f5f5",
	fg: "#111",
	border: "#e2e8f0",
	accent: "#0066ff",
	userMsg: "#0066ff",
};
const dark = {
	bg: "#0d1117",
	bgAlt: "#161b22",
	fg: "#c9d1d9",
	border: "#30363d",
	accent: "#58a6ff",
	userMsg: "#238636",
};
const lightTheme = { ...baseTheme, colors: { ...baseTheme.colors, ...light } };
const darkTheme = { ...baseTheme, colors: { ...baseTheme.colors, ...dark } };

const GlobalStyle = createGlobalStyle`
  html,body,#root{margin:0;padding:0;width:100%;height:100%;background:${(p) =>
		p.theme.colors.bg};color:${(p) => p.theme.colors.fg}}
  .spinner{animation:spin .4s linear infinite;display:inline-block;}
  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
`;

/* ---- tooltip ---- */
const Tip: React.FC<{ text: string; children: React.ReactNode }> = ({
	text,
	children,
}) => {
	const [v, setV] = useState(false);
	return (
		<TipWrap
			onMouseEnter={() => setV(true)}
			onMouseLeave={() => setV(false)}
			onFocus={() => setV(true)}
			onBlur={() => setV(false)}
		>
			{children}
			<AnimatePresence>
				{v && (
					<TipBubble
						as={motion.div}
						initial={{ opacity: 0, y: 4, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 4, scale: 0.95 }}
					>
						{text}
					</TipBubble>
				)}
			</AnimatePresence>
		</TipWrap>
	);
};

/* ======================================================================== */
/*                                   APP                                    */
/* ======================================================================== */
export default function App() {
	/* ---- theme ---- */
	const ls = localStorage?.getItem("vibe-theme") as "dark" | "light" | null;
	const ss = vscode.getState?.() as { mode?: "dark" | "light" } | undefined;
	const sys =
		window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
	const [mode, setMode] = useState<"dark" | "light">(
		ss?.mode ?? ls ?? (sys ? "dark" : "light")
	);
	const isDark = mode === "dark";
	const toggleMode = () => {
		const next = isDark ? "light" : "dark";
		vscode.setState?.({ mode: next });
		localStorage?.setItem("vibe-theme", next);
		setMode(next);
	};

	/* ---- auth ---- */
	const [email, setEmail] = useState("");
	const [pass, setPass] = useState("");
	const [user, setUser] = useState<any>(null);
	const [authErr, setAuthErr] = useState<string | null>(null);
	const [authLoad, setAuthLoad] = useState(false);

	/* ---- chat ---- */
	const [chats, setChats] = useState<Chat[]>([
		{
			id: genId(),
			sender: "agent",
			content: "Hi 👋 I’m your mobile-app dev agent…",
		},
	]);
	const [text, setText] = useState("");
	const [model, setModel] = useState(modelOptions[0].id);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);

	/* ---- VS Code info ---- */
	const [file, setFile] = useState("");
	const [appName, setAppName] = useState("");
	const [ver, setVer] = useState("");
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const m = e.data;
			if (!m?.type) return;
			if (m.type === "appInfo") {
				setAppName(m.name);
				setVer(m.version);
			}
			if (m.type === "activeFile") setFile(m.fileName);
		};
		window.addEventListener("message", handler);
		vscode.postMessage({ type: "getActiveFile" });
		return () => window.removeEventListener("message", handler);
	}, []);

	/* ---- settings dropdown ---- */
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [projName, setProjName] = useState("");
	const [projSlug, setProjSlug] = useState("");
	const [iosId, setIosId] = useState("");
	const [androidId, setAndroidId] = useState("");
	const [privacy, setPrivacy] = useState(false);
	const [icon, setIcon] = useState<File | null>(null);
	const saveSettings = () => {
		vscode.postMessage({
			type: "saveSettings",
			data: { projName, projSlug, iosId, androidId, privacy },
		});
		setSettingsOpen(false);
	};

	/* ---- publish dropdown ---- */
	const [publishOpen, setPublishOpen] = useState(false);
	const previewUrl = `${projSlug || "home-search-platform-84k99z4"}.rork.app`;

	/* ---- project list ---- */
	const projects = [
		{ id: "One", name: "One" },
		{ id: "Two", name: "Two" },
		{ id: "Three", name: "Three" },
	];
	const [activeProject, setActiveProject] = useState(projects[0].id);

	/* ---- helpers ---- */
	const boxRef = useRef<HTMLDivElement>(null);
	const scroll = () =>
		setTimeout(
			() =>
				boxRef.current?.scrollTo({
					top: boxRef.current.scrollHeight,
					behavior: "smooth",
				}),
			40
		);
	const push = useCallback(
		(sender: Chat["sender"], content: React.ReactNode) => {
			setChats((p) => [...p, { id: genId(), sender, content }]);
			scroll();
		},
		[]
	);
	const send = () => {
		if (!text.trim() || busy) return;
		setBusy(true);
		push("user", text);
		vscode.postMessage({ type: "prompt", value: text, model: modelMap[model] });
		setText("");
		setOpen(false);
	};

	/* ---- Supabase auth session ---- */
	useEffect(() => {
		supabase.auth
			.getSession()
			.then(({ data: { session } }) => setUser(session?.user || null));
		const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
			setUser(s?.user || null)
		);
		return () => sub.subscription.unsubscribe();
	}, []);
	const login = async () => {
		setAuthLoad(true);
		setAuthErr(null);
		const { error, data } = await supabase.auth.signInWithPassword({
			email,
			password: pass,
		});
		setAuthLoad(false);
		error ? setAuthErr(error.message) : setUser(data.session?.user || null);
	};
	const logout = () => supabase.auth.signOut().then(() => setUser(null));

	// Place at top of your App component, alongside other refs
	const savedBubbleRef = useRef<string | null>(null);

	// Message handler: group fileSaved messages in one live bubble with animations
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const m = e.data;
			if (!m?.type) return;

			const animateWrapper = (children: React.ReactNode) => (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 10 }}
					transition={{ duration: 0.3 }}
				>
					{children}
				</motion.div>
			);

			switch (m.type) {
				case "status":
					// clear any active saved bubble
					savedBubbleRef.current = null;
					push("agent", animateWrapper(<i>{m.message}</i>));
					break;

				case "fileSaved":
					const fileLine = (
						<>
							✅ <b>{m.file}</b> saved
						</>
					);
					if (savedBubbleRef.current) {
						// append to existing bubble
						setChats((prev) =>
							prev.map((c) => {
								if (c.id === savedBubbleRef.current) {
									return {
										...c,
										content: (
											<motion.div
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 10 }}
												transition={{ duration: 0.3 }}
											>
												{c.content}
												<div>{fileLine}</div>
											</motion.div>
										),
									};
								}
								return c;
							})
						);
					} else {
						// create new bubble
						const id = genId();
						savedBubbleRef.current = id;
						setChats((prev) => [
							...prev,
							{
								id,
								sender: "agent",
								content: animateWrapper(<div>{fileLine}</div>),
							},
						]);
					}
					break;

				case "expoQr": {
					savedBubbleRef.current = null;
					const { url, img, svg } = m;
					push(
						"agent",
						animateWrapper(
							<Container>
								{svg && (
									<QRContainer dangerouslySetInnerHTML={{ __html: svg }} />
								)}
								{img && <QRImage src={img} alt="Expo QR" />}
								<Big>{`exp://${url}`}</Big>
								<Heading>Scan QR with your phone</Heading>
								<Subtext>Expo Go will launch your app</Subtext>
							</Container>
						)
					);
					break;
				}

				case "done":
					savedBubbleRef.current = null;
					push("agent", animateWrapper(<b>{m.message}</b>));
					setBusy(false);
					break;

				case "error":
					savedBubbleRef.current = null;
					push(
						"agent",
						animateWrapper(
							<>
								<b>Error:</b> {m.message}
							</>
						)
					);
					setBusy(false);
					break;

				default:
					break;
			}
		};

		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [push]);
	/* ---- login screen ---- */
	if (!user) {
		return (
			<ThemeProvider theme={isDark ? darkTheme : lightTheme}>
				<GlobalStyle />
				<Auth>
					{authErr && <Err>{authErr}</Err>}
					<In
						type="email"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
					<In
						type="password"
						placeholder="Password"
						value={pass}
						onChange={(e) => setPass(e.target.value)}
					/>
					<Btn onClick={login} disabled={authLoad}>
						{authLoad ? "…" : "Login"}
					</Btn>
				</Auth>
			</ThemeProvider>
		);
	}

	/* ==================================================================== */
	/*                                 UI                                   */
	/* ==================================================================== */
	return (
		<ThemeProvider theme={isDark ? darkTheme : lightTheme}>
			<GlobalStyle />
			<Root>
				{/* ───── Sidebar ───── */}
				<Side>
					<Tip text="New chat">
						<Ico
							onClick={() =>
								setChats([
									{
										id: genId(),
										sender: "agent",
										content: "Hi 👋 Let’s start a new chat…",
									},
								])
							}
						>
							<Plus size={20} />
						</Ico>
					</Tip>

					<ProjectList>
						{projects.map((p) => (
							<ProjectItem
								key={p.id}
								$active={p.id === activeProject}
								onClick={() => setActiveProject(p.id)}
							>
								<LetterBadge>{p.name.charAt(0)}</LetterBadge>
							</ProjectItem>
						))}
					</ProjectList>
				</Side>

				{/* ───── Main ───── */}
				<Main>
					{/* ===== Header ===== */}
					<Head>
						<TitleGroup>
							<Title>{appName}</Title>
							<Lock size={16} />

							{/* ---------- Version dropdown ---------- */}
							<VersionBtn onClick={() => setSettingsOpen((o) => !o)}>
								{ver}
								{settingsOpen ? (
									<ChevronUp size={16} />
								) : (
									<ChevronDown size={16} />
								)}
							</VersionBtn>

							<AnimatePresence>
								{settingsOpen && (
									<SettingsCard
										as={motion.div}
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: 8 }}
									>
										{/* (форма настроек — оставлена без изменений) */}
										<SettingsGrid>
											<Field>
												<Label>Project name</Label>
												<Input
													placeholder="Enter project name"
													value={projName}
													onChange={(e) => setProjName(e.target.value)}
												/>
												<Hint>Name shown in Rork & stores</Hint>
											</Field>

											<Field>
												<Label>Project slug</Label>
												<Input
													placeholder="my-cool-app"
													value={projSlug}
													onChange={(e) => setProjSlug(e.target.value)}
												/>
												<Small>Checking availability…</Small>
											</Field>

											<Field>
												<Label>iOS Bundle ID</Label>
												<Input
													placeholder="app.rork.myapp"
													value={iosId}
													onChange={(e) => setIosId(e.target.value)}
												/>
												<Hint>Unique ID for App Store</Hint>
											</Field>

											<Field>
												<Label>Android Package</Label>
												<Input
													placeholder="app.rork.myapp"
													value={androidId}
													onChange={(e) => setAndroidId(e.target.value)}
												/>
												<Hint>Unique ID for Play Store</Hint>
											</Field>
										</SettingsGrid>

										<Section>
											<SectionLabel>App Icon</SectionLabel>
											<IconDrop>
												{icon ? (
													<img src={URL.createObjectURL(icon)} alt="icon" />
												) : (
													<Placeholder />
												)}
												<UploadBtn as="label">
													Change icon
													<input
														type="file"
														hidden
														accept="image/*"
														onChange={(e) => {
															if (e.target.files?.[0])
																setIcon(e.target.files[0]);
														}}
													/>
												</UploadBtn>
												<Small>Drag & drop or click to upload</Small>
											</IconDrop>
											<HintAuto>Auto-resized to 1024 px</HintAuto>
										</Section>

										<Section>
											<SectionLabel>Project privacy</SectionLabel>
											<PrivacyRow>
												<span>Keep project private</span>
												<Toggle
													type="checkbox"
													checked={privacy}
													onChange={(e) => setPrivacy(e.target.checked)}
												/>
											</PrivacyRow>
											<HintSmall>Requires Rork Pro</HintSmall>
										</Section>

										<DangerRow>
											<DangerBtn onClick={() => alert("Delete forever")}>
												Delete
											</DangerBtn>
											<span>This action cannot be undone</span>
										</DangerRow>

										<SaveBtn onClick={saveSettings}>Save changes</SaveBtn>
									</SettingsCard>
								)}
							</AnimatePresence>
						</TitleGroup>

						{/* ---------- Publish dropdown ---------- */}
						<PublishWrap>
							<Tip text="Publish">
								<Ico onClick={() => setPublishOpen((o) => !o)}>
									<Upload size={18} />
								</Ico>
							</Tip>

							<AnimatePresence>
								{publishOpen && (
									<PublishMenu
										as={motion.div}
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: 8 }}
									>
										<PubSection>
											<H2>App preview</H2>
											<InputLike>
												{previewUrl}
												<LinkIcon size={16} />
											</InputLike>
											<BigBtn
												onClick={() =>
													window.open(`https://${previewUrl}`, "_blank")
												}
											>
												<ExternalLink size={18} /> Open
											</BigBtn>
										</PubSection>

										<Divider />

										<PubSection>
											<H2>App stores</H2>
											<BigBtn>
												<Apple size={18} /> Publish to App Store
											</BigBtn>
											<BigBtn>
												<Store size={18} /> Publish to Google Play
											</BigBtn>
										</PubSection>
									</PublishMenu>
								)}
							</AnimatePresence>
						</PublishWrap>

						{/* Theme toggle */}
						<Ico title="Toggle theme" onClick={toggleMode}>
							{isDark ? <Sun size={18} /> : <Moon size={18} />}
						</Ico>

						<User>
							{user.email}
							<Logout onClick={logout}>Logout</Logout>
						</User>
						{!!file && (
							<File>
								<Dot />
								{file}
							</File>
						)}
					</Head>

					{/* ===== Chat ===== */}
					<Box ref={boxRef}>
						{chats.map((m) => (
							<Msg key={m.id} sender={m.sender}>
								{m.sender === "agent" && (
									<Meta>
										<DotA />
										{modelOptions.find((o) => o.id === model)!.name}
									</Meta>
								)}
								<Bubble sender={m.sender}>{m.content}</Bubble>
							</Msg>
						))}
					</Box>

					{/* ===== Input panel ===== */}
					<Panel $dim={busy}>
						{busy && (
							<Overlay
								as={motion.div}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
							>
								<Spin className="spinner" /> Processing…
							</Overlay>
						)}

						<Top>
							<Tip text="Upload image">
								<Chip>
									<Camera size={16} />
								</Chip>
							</Tip>

							<Picker>
								<Pick $open={open} onClick={() => setOpen((o) => !o)}>
									{React.createElement(
										modelOptions.find((o) => o.id === model)!.icon,
										{ size: 16 }
									)}
									<span>{modelOptions.find((o) => o.id === model)!.name}</span>
									{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
								</Pick>
								<AnimatePresence>
									{open && (
										<Menu
											as={motion.div}
											initial={{ opacity: 0, y: 4 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: 4 }}
										>
											<MenuHead>AI model</MenuHead>
											{modelOptions.map((opt) => (
												<Item
													key={opt.id}
													$sel={opt.id === model}
													onClick={() => {
														setModel(opt.id);
														setOpen(false);
													}}
												>
													<IconWrap>
														<opt.icon size={16} />
													</IconWrap>
													<TextWrap>
														<strong>{opt.name}</strong>
														<small>{opt.desc}</small>
													</TextWrap>
													{/* опционально: маркер выбранного справа */}
													{opt.id === model && <DotA />}
												</Item>
											))}
										</Menu>
									)}
								</AnimatePresence>
							</Picker>
						</Top>

						<Mid>
							<TA
								placeholder="Type a message…"
								value={text}
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
								disabled={busy}
							/>
						</Mid>

						<Bot>
							<Chips>
								{[
									{
										tip: "Install dependencies",
										icon: Activity,
										act: "installDeps",
										label: "Install",
									},
									{
										tip: "Start Expo",
										icon: Play,
										act: "startExpo",
										label: "Start",
									},
									{
										tip: "Stop Expo",
										icon: Square,
										act: "stopExpo",
										label: "Stop",
									},
									{
										tip: "Clean node_modules",
										icon: Trash,
										act: "deleteNodeModules",
										label: "Clean libs",
									},
								].map((b) => (
									<Tip key={b.act} text={b.tip}>
										<Chip
											onClick={() =>
												vscode.postMessage({ type: "action", action: b.act })
											}
										>
											{React.createElement(b.icon, { size: 16 })}
											{b.label}
										</Chip>
									</Tip>
								))}
							</Chips>
							<Ico onClick={send} disabled={busy}>
								{busy ? <Spin className="spinner" /> : <Send size={18} />}
							</Ico>
						</Bot>
					</Panel>
				</Main>
			</Root>
		</ThemeProvider>
	);
}

/* ====================================================================== */
/*                              styled-components                         */
/* ====================================================================== */

/* ---- layout ---- */
const Root = styled.div`
	display: flex;
	width: 100%;
	height: 100vh;
`;
const Side = styled.aside`
	width: ${(p) => p.theme.sizes.sidebarWidth};
	background: ${(p) => p.theme.colors.bgAlt};
	border-right: 1px solid ${(p) => p.theme.colors.border};
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 16px 0;
`;
const Main = styled.main`
	flex: 1;
	display: flex;
	flex-direction: column;
`;

/* ---- header ---- */
const Head = styled.header`
	height: ${(p) => p.theme.sizes.headerHeight};
	display: flex;
	align-items: center;
	padding: 0 24px;
	background: ${(p) => p.theme.colors.bgAlt};
	border-bottom: 1px solid ${(p) => p.theme.colors.border};
`;
const TitleGroup = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	position: relative;
`;
const Title = styled.h1`
	margin: 0;
	font-size: 18px;
	font-weight: 600;
`;
const VersionBtn = styled.button`
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 10px;
	font-size: 14px;
	border-radius: 8px;
	border: 1px solid ${({ theme }) => theme.colors.border};
	background: ${({ theme }) => theme.colors.bgAlt};
	color: ${({ theme }) => theme.colors.fg};
	cursor: pointer;
`;

/* ---- publish dropdown wrap ---- */
const PublishWrap = styled.div`
	position: relative;
	/* margin-left немного, чтобы кнопки не слипались */
	margin-left: 12px;
`;

const PublishMenu = styled(motion.div)`
	position: fixed;
	top: calc(${({ theme }) => theme.sizes.headerHeight} + 20px);
	left: 0;
	right: 0;
	margin: 0 auto;
	width: 480px;
	max-width: 90vw;
	background: ${(p) => p.theme.colors.bgAlt};
	border: 1px solid ${(p) => p.theme.colors.border};
	border-radius: 12px;
	padding: 24px;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
	display: flex;
	flex-direction: column;
	gap: 24px;
	z-index: 70;
`;

/* ---- sidebar projects ---- */
const ProjectList = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-top: 24px;
`;
const ProjectItem = styled.button<{ $active?: boolean }>`
	width: 48px;
	height: 48px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px solid
		${(p) => (p.$active ? p.theme.colors.accent : p.theme.colors.border)};
	background: ${(p) => (p.$active ? p.theme.colors.accent : "transparent")};
	color: ${(p) => (p.$active ? "#fff" : p.theme.colors.fg)};
	cursor: pointer;
	transition: transform 0.2s;
	&:hover {
		transform: scale(1.1);
	}
`;
const LetterBadge = styled.span`
	font-weight: 600;
	font-size: 15px;
`;

/* ---- chat ---- */
const Box = styled.div`
	flex: 1;
	overflow-y: auto;
	padding: 24px;
	display: flex;
	flex-direction: column;
	gap: 16px;
`;
const Msg = styled.div<{ sender: string }>`
	display: flex;
	flex-direction: column;
	align-items: ${(p) => (p.sender === "user" ? "flex-end" : "flex-start")};
`;
const Meta = styled.div`
	font-size: 12px;
	color: #999;
	display: flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 4px;
`;

const Bubble = styled.div<{ sender: string }>`
	max-width: 75%;
	padding: 12px 16px;
	border-radius: 16px;
	border: 1px solid ${(p) => p.theme.colors.border};
	background: ${(p) =>
		p.sender === "agent" ? p.theme.colors.bgAlt : p.theme.colors.userMsg};
	color: ${(p) =>
		p.sender === "agent" ? p.theme.colors.fg : p.theme.colors.bg};
`;

/* ---- input panel ---- */
const Panel = styled.div<{ $dim?: boolean }>`
	position: relative;
	margin: 16px 24px;
	background: ${(p) => p.theme.colors.bgAlt};
	border: 1px solid ${(p) => p.theme.colors.border};
	border-radius: 16px;
	${(p) =>
		p.$dim &&
		css`
			opacity: 0.6;
			pointer-events: none;
		`}
`;
const Top = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	border-bottom: 1px solid ${(p) => p.theme.colors.border};
`;
const Mid = styled.div`
	padding: 12px 16px;
`;
const Bot = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	border-top: 1px solid ${(p) => p.theme.colors.border};
`;
const TA = styled.textarea`
	box-sizing: border-box; /* добавили */
	width: 100%;
	min-height: 44px;
	resize: none;
	border: none;
	border-radius: 12px;
	padding: 12px 16px; /* учтётся в расчёте ширины */
	font-size: 14px;
	background: ${(p) => p.theme.colors.bg};
	color: ${(p) => p.theme.colors.fg};
`;

/* ---- chips & picker ---- */
const Chip = styled.button`
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 12px;
	border-radius: 999px;
	border: 1px solid ${(p) => p.theme.colors.border};
	background: ${(p) => p.theme.colors.bg};
	color: ${(p) => p.theme.colors.fg};
	cursor: pointer;
`;
const Chips = styled.div`
	display: flex;
	gap: 12px;
`;
const Picker = styled.div`
	position: relative;
`;
const Pick = styled.button<{ $open: boolean }>`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 16px;
	border: 1px solid ${({ theme }) => theme.colors.border};
	background: ${({ theme, $open }) =>
		$open ? theme.colors.bgAlt : theme.colors.bg};
	color: ${({ theme }) => theme.colors.fg};
	border-radius: 12px;
	font-size: 14px;
	cursor: pointer;
	transition: background 0.2s, box-shadow 0.2s;

	&:hover {
		background: ${({ theme }) => theme.colors.bgAlt};
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
`;
const Menu = styled.div`
	position: absolute;
	top: calc(100% + 6px);
	left: 0;
	width: 240px;
	background: ${({ theme }) => theme.colors.bgAlt};
	border: 1px solid ${({ theme }) => theme.colors.border};
	border-radius: 12px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	padding: 8px 0; /* отступ сверху/снизу внутри всего меню */
	z-index: 20;
`;

const MenuHead = styled.div`
	padding: 8px 16px; /* внутренние отступы у заголовка */
	font-weight: 600;
	font-size: 13px;
	color: ${({ theme }) => theme.colors.fg};
	border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

// Обёртка для иконки — фиксированная ширина, чтобы текст начинался с одинаковой позиции
const IconWrap = styled.div`
	width: 20px; /* фиксируем поле иконки */
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 8px; /* небольшой отступ до текста */
`;

// Контейнер для текста — займёт всё оставшееся место
const TextWrap = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px; /* отступ между заголовком и подписью */
	flex: 1;
`;

// Кнопка-пункт выпадашки
const Item = styled.button<{ $sel: boolean }>`
	display: flex;
	align-items: center;
	width: 100%;
	padding: 8px 16px; /* внутренние отступы пункта */
	background: ${({ theme, $sel }) =>
		$sel ? `${theme.colors.accent}1A` : "transparent"};
	color: ${({ theme, $sel }) => ($sel ? theme.colors.accent : theme.colors.fg)};
	border: none;
	cursor: pointer;
	transition: background 0.2s;

	&:hover {
		background: ${({ theme }) => `${theme.colors.border}20`};
	}
`;

// 3) Маркер—точка при выбранном элементе уезжает вправо
const DotA = styled.span`
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: ${({ theme }) => theme.colors.accent};
	margin-left: auto;
`;

/* ---- busy overlay ---- */
const Overlay = styled.div`
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	background: rgba(0, 0, 0, 0.25);
	backdrop-filter: blur(4px);
	border-radius: 16px;
	color: #fff;
	font-weight: 500;
`;
const Spin = styled(Info)`
	animation: spin 0.8s linear infinite;
`;

/* ---- auth screen ---- */
const Auth = styled.div`
	height: 100vh;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	gap: 12px;
`;
const In = styled.input`
	width: 280px;
	padding: 10px;
	border-radius: 8px;
	border: 1px solid ${(p) => p.theme.colors.border};
	background: ${(p) => p.theme.colors.bgAlt};
	color: ${(p) => p.theme.colors.fg};
`;
const Btn = styled.button`
	padding: 10px 20px;
	border: none;
	border-radius: 8px;
	background: ${(p) => p.theme.colors.accent};
	color: #fff;
	cursor: pointer;
	opacity: ${(p) => (p.disabled ? 0.6 : 1)};
`;
const Err = styled.p`
	color: #f00;
`;

/* ---- header user ---- */
const User = styled.div`
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: 12px;
	font-size: 14px;
`;
const Logout = styled.button`
	padding: 6px 12px;
	border: none;
	border-radius: 8px;
	background: #e00;
	color: #fff;
	cursor: pointer;
`;
const File = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	margin-left: 24px;
	font-size: 14px;
	color: #0f0;
`;
const Dot = styled.span`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: #0f0;
`;

/* ---- tooltip & icon ---- */
const TipWrap = styled.span`
	position: relative;
	display: inline-block;
`;
const TipBubble = styled.div`
	position: absolute;
	bottom: 100%;
	left: 50%;
	transform: translateX(-50%);
	margin-bottom: 8px;
	padding: 6px 10px;
	border-radius: 8px;
	background: ${(p) => p.theme.colors.fg};
	color: ${(p) => p.theme.colors.bg};
	font-size: 13px;
	font-weight: 500;
	white-space: nowrap;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
`;
const Ico = styled.button`
	background: transparent;
	border: none;
	padding: 8px;
	border-radius: 8px;
	color: ${(p) => p.theme.colors.fg};
	cursor: pointer;
	transition: 0.2s;
	&:hover {
		background: rgba(255, 255, 255, 0.08);
		transform: scale(1.1);
	}
	&:disabled {
		opacity: 0.6;
	}
`;

/* ---- settings dropdown ---- */
const SettingsCard = styled(motion.div)`
	position: fixed;
	top: calc(${({ theme }) => theme.sizes.headerHeight} + 20px);
	left: 0;
	right: 0;
	margin: 0 auto;
	width: 560px;
	max-width: 90vw;
	background: ${({ theme }) => theme.colors.bgAlt};
	color: ${({ theme }) => theme.colors.fg}; /* <— добавлено */
	border: 1px solid ${({ theme }) => theme.colors.border};
	border-radius: 12px;
	padding: 24px;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
	display: flex;
	flex-direction: column;
	gap: 24px;
	z-index: 70;
`;
const SettingsGrid = styled.div`
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 24px 16px;
`;
const Field = styled.div`
	display: flex;
	flex-direction: column;
	gap: 6px;
`;
const Label = styled.label`
	font-size: 14px;
	font-weight: 600;
`;
const Input = styled.input`
	color: ${({ theme }) => theme.colors.fg};
	background: ${({ theme }) => theme.colors.bg};
	border: 1px solid ${({ theme }) => theme.colors.border};
	padding: 10px;
	border-radius: 8px;
	font-size: 14px;

	&::placeholder {
		color: ${({ theme }) => theme.colors.fg}80; /* чуть прозрачнее основного */
	}
`;
const Hint = styled.span`
	font-size: 12px;
	opacity: 0.7;
`;
const Small = styled(Hint)`
	margin-top: -2px;
`;
const Section = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12px;
`;
const SectionLabel = styled(Label)``;
const IconDrop = styled.div`
	border: 2px dashed ${(p) => p.theme.colors.border};
	border-radius: 12px;
	padding: 24px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
	text-align: center;
	img {
		width: 96px;
		height: 96px;
		border-radius: 20%;
		object-fit: cover;
	}
`;
const UploadBtn = styled.button`
	padding: 8px 16px;
	border-radius: 8px;
	border: none;
	cursor: pointer;
	background: ${(p) => p.theme.colors.accent};
	color: #fff;
	font-size: 14px;
	font-weight: 600;
`;
const Placeholder = styled.div`
	width: 96px;
	height: 96px;
	border-radius: 20%;
	background: #5553;
`;
const HintAuto = styled(Hint)``;
const PrivacyRow = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 16px;
`;
const Toggle = styled.input``;
const HintSmall = styled(Hint)``;
const DangerRow = styled.div`
	padding-top: 12px;
	border-top: 1px solid ${(p) => p.theme.colors.border};
	display: flex;
	align-items: center;
	gap: 16px;
	color: #c0392b;
	font-size: 14px;
`;
const DangerBtn = styled.button`
	background: #c0392b;
	border: none;
	color: #fff;
	border-radius: 8px;
	padding: 8px 16px;
	cursor: pointer;
`;
const SaveBtn = styled.button`
	align-self: center;
	margin-top: 8px;
	width: 200px;
	background: ${(p) => p.theme.colors.accent};
	border: none;
	border-radius: 8px;
	padding: 12px;
	color: #fff;
	font-weight: 600;
	cursor: pointer;
`;

/* ---- publish dropdown inner ---- */
const PubSection = styled.div`
	display: flex;
	flex-direction: column;
	gap: 16px;
`;
const H2 = styled.h2`
	margin: 0;
	font-size: 15px;
	font-weight: 600;
`;
const InputLike = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 12px 14px;
	border: 1px solid ${(p) => p.theme.colors.border};
	border-radius: 10px;
	background: ${(p) => p.theme.colors.bg};
	font-size: 14px;
	svg {
		opacity: 0.6;
	}
`;
const BigBtn = styled.button`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
	padding: 12px 0;
	border: none;
	border-radius: 10px;
	font-size: 15px;
	font-weight: 600;
	cursor: pointer;
	background: ${(p) => p.theme.colors.accent};
	color: #fff;
	&:hover {
		filter: brightness(1.05);
	}
`;
const Divider = styled.hr`
	border: none;
	border-top: 1px solid ${(p) => p.theme.colors.border};
`;

const Container = styled.div`
	max-width: 400px;
	margin: 20px auto;
	background: ${({ theme }) => theme.colors.bgAlt};
	border-radius: 20px;
	padding: 32px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
	position: relative;
	overflow: hidden;

	&::before {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 4px;
		background: linear-gradient(
			90deg,
			${({ theme }) => theme.colors.accent},
			transparent
		);
	}
`;

const QRContainer = styled.div`
	width: 220px;
	height: 220px;
	border: 2px solid ${({ theme }) => theme.colors.accent};
	border-radius: 16px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
	background: ${({ theme }) => theme.colors.bg};
`;

const QRImage = styled.img`
	width: 100%;
	height: 100%;
	object-fit: contain;
	animation: fadeIn 0.5s ease-in-out;

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
`;

const Big = styled.code`
	font-size: 18px;
	font-family: "Courier New", Courier, monospace;
	background: ${({ theme }) => theme.colors.bg};
	padding: 8px 12px;
	border-radius: 6px;
	border: 1px solid ${({ theme }) => theme.colors.border};
	word-break: break-all;
	text-align: center;
	transition: background 0.2s;

	&:hover {
		background: ${({ theme }) => theme.colors.accent}10;
	}
`;

const Heading = styled.h3`
	margin: 0;
	font-size: 20px;
	font-weight: 700;
	background: linear-gradient(
		45deg,
		${({ theme }) => theme.colors.accent},
		${({ theme }) => theme.colors.accent}80
	);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
`;

const Subtext = styled.p`
	margin: 0;
	font-size: 14px;
	color: ${({ theme }) => theme.colors.fg}80;
	font-style: italic;
`;
