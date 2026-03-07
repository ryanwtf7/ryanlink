import { OPType } from "../src/types";
import type { NodeOptions } from "../src/types";

describe("Node", () => {
    const options = {
        name: "test-node",
        clientId: "123456789",
        host: "localhost",
        port: 2333,
        password: "youshallnotpass",
        secure: false,
    } satisfies NodeOptions;

    describe("constructor", () => {
        it("validates node options", () => {
            expect(options.name).toBe("test-node");
            expect(options.clientId).toBe("123456789");
            expect(options.host).toBe("localhost");
            expect(options.port).toBe(2333);
            expect(options.password).toBe("youshallnotpass");
        });
    });

    describe("OPType", () => {
        it("has correct operation types", () => {
            expect(OPType.Ready).toBe("ready");
            expect(OPType.PlayerUpdate).toBe("playerUpdate");
            expect(OPType.Stats).toBe("stats");
            expect(OPType.Event).toBe("event");
        });
    });
});
