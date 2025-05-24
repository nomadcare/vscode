// File: src/fileWriter.ts
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class FileWriter {
	/** Имя, по которому будем находить и закрывать «наши» терминалы */
	private static readonly TERM_NAME = "Expo Project";

	// ───────── helpers ─────────
	private getWorkspaceFolder(): string {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) throw new Error("Рабочая папка не открыта в VS Code");
		return folders[0].uri.fsPath;
	}

	/** Закрыть все прежние «Expo Project» терминалы и создать новый */
	private createFreshTerminal(): vscode.Terminal {
		// 1. гасим старые
		for (const t of vscode.window.terminals) {
			if (t.name === FileWriter.TERM_NAME) t.dispose();
		}
		// 2. открываем новый
		const term = vscode.window.createTerminal({ name: FileWriter.TERM_NAME });
		term.show(true);
		return term;
	}

	// ───────── 1. запись файлов ─────────
	async writeFile(filePath: string, content: string): Promise<void> {
		const cwd = this.getWorkspaceFolder();
		const full = path.join(cwd, filePath);
		await fs.promises.mkdir(path.dirname(full), { recursive: true });
		await fs.promises.writeFile(full, content.replace(/\r\n/g, "\n"), "utf8");
	}

	// ───────── 2. действия по кнопкам ─────────
	async installDependencies(): Promise<void> {
		const cwd = this.getWorkspaceFolder();
		const useYarn = fs.existsSync(path.join(cwd, "yarn.lock"));
		const installCmd = useYarn ? "yarn install" : "npm install";

		const term = this.createFreshTerminal();
		term.sendText(`cd "${cwd}"`);
		term.sendText(installCmd);
	}

	async startExpo(): Promise<void> {
		const cwd = this.getWorkspaceFolder();
		const term = this.createFreshTerminal();
		term.sendText(`cd "${cwd}"`);
		term.sendText("npx expo start");
	}

	async stopExpo(): Promise<void> {
		// просто закрываем все наши терминалы; новая вкладка не нужна
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

	/** Back-compat: раньше запускалось автоматически */
	async installDependenciesAndLaunch(): Promise<void> {
		await this.installDependencies();
		await this.startExpo();
	}
}
