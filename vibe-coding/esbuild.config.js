// esbuild.config.js
const esbuild = require("esbuild");
const path = require("path");

async function buildExtension() {
	await esbuild.build({
		entryPoints: [path.resolve(__dirname, "src", "extension.ts")],
		bundle: true,
		platform: "node",
		external: ["vscode"],
		sourcemap: true,
		outfile: "dist/extension.js",
	});
	console.log("🟢 Extension built");
}

async function buildWebview(watch = false) {
	const config = {
		entryPoints: [path.resolve(__dirname, "src", "webview", "index.tsx")],
		bundle: true,
		platform: "browser", // <-- вот тут!
		target: ["es2020"], // таргетируем современные браузеры
		sourcemap: true,
		outfile: "dist/webview.js",
	};

	if (watch) {
		const ctx = await esbuild.context(config);
		await ctx.watch({
			onRebuild(err) {
				if (err) console.error("❌ Webview rebuild failed:", err);
				else console.log("✅ Webview rebuilt");
			},
		});
		console.log("👀 Watching Webview…");
	} else {
		await esbuild.build(config);
		console.log("🟢 Webview built");
	}
}

(async () => {
	// npm run build-webview            → one-time
	// npm run watch-webview (––watch)  → с пересборкой
	const watch = process.argv.includes("--watch");
	await buildExtension();
	await buildWebview(watch);
})();
