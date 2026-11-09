import { describe, expect, it } from "vitest";
import { busName } from "./format";

describe("busName", () => {
    it("보통 번호는 'N번 버스'", () => {
        expect(busName("740")).toBe("740번 버스");
    });

    it("괄호 접미사는 버스 종류로 옮겨요", () => {
        expect(busName("N75(심야)")).toBe("N75번 심야버스");
        expect(busName("8100(급행)")).toBe("8100번 급행버스");
    });
});
