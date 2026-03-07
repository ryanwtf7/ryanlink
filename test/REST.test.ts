declare const $clientName: string;
declare const $clientVersion: string;
declare const $clientRepository: string;

import { REST } from "../src/lavalink/HttpClient";
import type { RESTOptions } from "../src/types";

describe("REST", () => {
    const options = {
        origin: "http://localhost:4000",
        password: "youshallnotpass",
    } satisfies RESTOptions;

    describe("constructor", () => {
        it("throws for invalid inputs", () => {
            expect(() => new REST({ ...options, origin: "ftp://example.com" })).toThrow();
            expect(() => new REST({ ...options, version: 0 })).toThrow();
            expect(() => new REST({ ...options, password: "12\n34" })).toThrow();
            expect(() => new REST({ ...options, userAgent: "bot/1.0.0\r\n" })).toThrow();
            expect(() => new REST({ ...options, requestTimeout: 0 })).toThrow();
        });

        it("constructs for proper input", () => {
            const r = new REST({ ...options, sessionId: "123", userAgent: "bot/1.0.0" });
            expect(r.origin).toBe(options.origin);
            expect(r.sessionId).toBe("123");
            expect(r.userAgent).toBe("bot/1.0.0");
        });
    });

    describe("property", () => {
        it("has essential fields defined", () => {
            const r = new REST(options);
            expect(r.origin).toBe("http://localhost:4000");
            expect(r.sessionId).toBeNull();
            expect(r.userAgent).toBe($clientName + "/" + $clientVersion + " (" + $clientRepository + ")");
        });

        it("behaves as expected for accessors", () => {
            const r = new REST(options);
            r.sessionId = "123";
            expect(r.sessionId).toBe("123");
            r.sessionId = 123 as any;
            r.sessionId = " ";
            expect(r.sessionId).toBe("123");
            r.sessionId = null;
            expect(r.sessionId).toBeNull();
        });
    });
});
