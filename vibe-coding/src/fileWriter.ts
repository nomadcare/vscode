// File: fileWriter.ts
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class FileWriter {
	// Определяем путь рабочей папки пользователя
	private getWorkspaceFolder(): string {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders || folders.length === 0) {
			throw new Error("Рабочая папка не открыта в VS Code");
		}
		return folders[0].uri.fsPath;
	}

	// Запись содержимого в файл (с созданием директорий при необходимости)
	async writeFile(filePath: string, content: string): Promise<void> {
		const workspacePath = this.getWorkspaceFolder();
		const fullPath = path.join(workspacePath, filePath);
		// Создаём директорию, если её нет
		await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
		// Убираем возможные символы возврата каретки (\r)
		const normalizedContent = content.replace(/\r\n/g, "\n");
		// Пишем файл
		await fs.promises.writeFile(fullPath, normalizedContent, "utf-8");
	}

	// Установка зависимостей и запуск Expo
	async installDependenciesAndLaunch(): Promise<void> {
		const workspacePath = this.getWorkspaceFolder();
		// Определяем, использовать ли Yarn
		const useYarn = fs.existsSync(path.join(workspacePath, "yarn.lock"));
		const installCommand = useYarn ? "yarn install" : "npm install";
		const expoStartCommand = "npx expo start";

		// Создаём терминал VS Code
		const terminal = vscode.window.createTerminal({ name: "Expo Project" });
		terminal.show(true);
		// Переходим в рабочую директорию
		terminal.sendText(`cd "${workspacePath}"`);
		// Устанавливаем зависимости
		terminal.sendText(installCommand);
		// Запускаем Expo после установки
		terminal.sendText(useYarn ? `yarn expo start` : expoStartCommand);
	}
}
