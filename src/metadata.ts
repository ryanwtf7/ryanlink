import { readFileSync } from "node:fs";
import { join } from "node:path";

interface PackageJson {
    name: string;
    version: string;
    description?: string;
    repository?: {
        type: string;
        url: string;
    };
}

let packageInfo: PackageJson | null = null;

/**
 * Load package.json information
 * Cached after first load for performance
 */
function loadPackageInfo(): PackageJson {
    if (packageInfo) {
        return packageInfo;
    }

    try {
        const possiblePaths = [
            join(__dirname, "..", "..", "package.json"),
            join(__dirname, "..", "package.json"),
            join(process.cwd(), "package.json"),
        ];

        for (const path of possiblePaths) {
            try {
                const content = readFileSync(path, "utf-8");
                packageInfo = JSON.parse(content) as PackageJson;
                return packageInfo;
            } catch {
                continue;
            }
        }

        console.warn("Could not load package.json, using fallback values");
        return {
            name: "ryanlink",
            version: "1.0.0",
            repository: {
                type: "git",
                url: "https://github.com/ryanwtf7/ryanlink.git",
            },
        };
    } catch (error) {
        return {
            name: "ryanlink",
            version: "1.0.0",
            repository: {
                type: "git",
                url: "https://github.com/ryanwtf7/ryanlink.git",
            },
        };
    }
}

const pkg = loadPackageInfo();

/**
 * Package name
 */
export const CLIENT_NAME = pkg.name;

/**
 * Package version
 */
export const CLIENT_VERSION = pkg.version;

/**
 * Package repository URL
 */
export const CLIENT_REPOSITORY = pkg.repository?.url.replace(/\.git$/, "") ?? "https://github.com/ryanwtf7/ryanlink";

/**
 * Full package information
 */
export const PACKAGE_INFO = Object.freeze({
    name: CLIENT_NAME,
    version: CLIENT_VERSION,
    repository: CLIENT_REPOSITORY,
    description: pkg.description,
});
