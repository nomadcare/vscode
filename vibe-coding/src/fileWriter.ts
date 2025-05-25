import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";

export class FileWriter {
	private static readonly TERM_NAME = "Expo Project";

	private getWorkspaceFolder(): string {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) throw new Error("Рабочая папка не открыта в VS Code");
		return folders[0].uri.fsPath;
	}

	private createFreshTerminal(): vscode.Terminal {
		for (const t of vscode.window.terminals) {
			if (t.name === FileWriter.TERM_NAME) t.dispose();
		}
		const term = vscode.window.createTerminal({ name: FileWriter.TERM_NAME });
		term.show(true);
		return term;
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		const cwd = this.getWorkspaceFolder();
		const full = path.join(cwd, filePath);
		await fs.promises.mkdir(path.dirname(full), { recursive: true });
		await fs.promises.writeFile(full, content.replace(/\r\n/g, "\n"), "utf8");
	}

	async installDependencies(): Promise<void> {
		const cwd = this.getWorkspaceFolder();
		const useYarn = fs.existsSync(path.join(cwd, "yarn.lock"));
		const installCmd = useYarn ? "yarn install" : "npm install";

		const term = this.createFreshTerminal();
		term.sendText(`cd "${cwd}"`);
		term.sendText(installCmd);
	}

	async startExpo(port: number = 8080): Promise<string> {
		const cwd = this.getWorkspaceFolder();
		const term = this.createFreshTerminal();
		term.sendText(`cd "${cwd}"`);
		term.sendText(`npx expo start --port ${port} --tunnel`);

		await new Promise((resolve) => setTimeout(resolve, 10000));

		// Функция, которая пытается достать hostUri из JSON-ответа
		const fetchHostUri = (): Promise<string> =>
			new Promise((resolve, reject) => {
				const req = http.request(
					{ hostname: "localhost", port, path: "/", method: "GET" },
					(res) => {
						let data = "";
						res.on("data", (chunk) => (data += chunk));
						res.on("end", () => {
							try {
								const json = JSON.parse(data);

								const hostUri = json.extra?.expoClient?.hostUri;
								if (hostUri) {
									resolve(hostUri);
								}
							} catch {}
						});
					}
				);
				req.on("error", reject);
				req.end();
			});

		// Пытаем pull каждые 2 секунды, максимум 20 секунд
		const timeout = 20000;
		const interval = 2000;
		const start = Date.now();
		while (true) {
			try {
				const uri = await Promise.race([
					fetchHostUri(),
					new Promise<string>((_, rej) =>
						Date.now() - start > timeout ? rej(new Error("Timeout")) : null
					),
				]);
				return uri;
			} catch {
				if (Date.now() - start > timeout) {
					throw new Error("Не удалось получить hostUri за 20 секунд");
				}
				await new Promise((r) => setTimeout(r, interval));
			}
		}
	}

	async stopExpo(): Promise<void> {
		for (const t of vscode.window.terminals) {
			if (t.name === FileWriter.TERM_NAME) t.dispose();
		}
	}

	async deleteNodeModules(): Promise<void> {
		const cwd = this.getWorkspaceFolder();
		const term = this.createFreshTerminal();
		term.sendText(`cd "${cwd}"`);
		term.sendText("rm -rf node_modules");
	}

	async installDependenciesAndLaunch(): Promise<void> {
		await this.installDependencies();
		await this.startExpo();
	}
}
