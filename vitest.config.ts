import { defineConfig } from "vitest/config";
import { name, version, repository } from "./package.json";

export default defineConfig({
    define: {
        $clientName: `"${name}"`,
        $clientVersion: `"${version}"`,
        $clientRepository: `"${repository.url}"`,
    },
    test: {
        globals: true,
        reporters: process.env.GITHUB_ACTIONS ? ["tree", "github-actions"] : ["tree"],
        environment: "node",
        coverage: {
            enabled: false,
            provider: "v8",
            reporter: ["text", "lcov", "clover", "json"],
            reportsDirectory: "coverage",
            include: [
                "src/utils/{helpers,validators}.ts",
                "src/lavalink/{HttpClient,LavalinkConnection}.ts",
                "src/audio/{AudioTrack,TrackCollection}.ts",
            ],
        },
    },
});
