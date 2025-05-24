// File: projectSnapshot.ts
import { promises as fs } from "fs";
import * as path from "path";

const EXCLUDE_DIRS = new Set([
	"node_modules",
	".git",
	"android",
	"ios",
	"web",
	"build",
	"dist",
]);
const BINARY_RE = /\.(png|jpe?g|webp|gif|svg|ttf|otf|mp4|mov|zip|gz)$/i;
const SIZE_LIMIT = 100 * 1024; // 100 KB

export class ProjectSnapshot {
	constructor(private root: string) {}

	async collect(): Promise<string> {
		const parts: string[] = [];
		await this.walk(this.root, parts);
		return parts.join("\n");
	}

	private async walk(dir: string, parts: string[]) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			if (EXCLUDE_DIRS.has(e.name)) continue;
			const full = path.join(dir, e.name);
			if (e.isDirectory()) {
				await this.walk(full, parts);
			} else if (!BINARY_RE.test(e.name)) {
				const stat = await fs.stat(full);
				if (stat.size > SIZE_LIMIT) continue;
				const rel = path.relative(this.root, full);
				const code = await fs.readFile(full, "utf8");
				parts.push(`// File: ${rel}\n${code}\n`);
			}
		}
	}
}
