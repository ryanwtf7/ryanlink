import { beforeAll, afterAll, afterEach } from "vitest";

beforeAll(() => {
    console.log("Starting test suite...");
});

afterAll(() => {
    console.log("Test suite completed!");
});

afterEach(() => {});
