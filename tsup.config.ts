import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: false,
    treeshake: true,
    outDir: "dist",
    target: "es2022",
    platform: "neutral",
    external: ["ws", /^node:/],
    noExternal: [],
    bundle: true,
    skipNodeModulesBundle: true,
    esbuildOptions(options) {
        options.banner = {
            js: "/* Ryanlink v1.0.0 - Modern Lavalink Client | Apache-2.0 License | https://github.com/ryanwtf7/ryanlink */",
        };
    },
    outExtension({ format }) {
        return {
            js: format === "cjs" ? ".js" : ".mjs",
        };
    },
    onSuccess: async () => {
        console.log("✓ Build completed successfully!");
    },
});
