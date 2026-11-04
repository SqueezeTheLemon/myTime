import { describe, it, expect } from "vitest";
import { parseRouteQuery } from "./route_query";

const NOW = 1_800_000_000;

// 서울역 → 강남역, 마감 1시간 뒤
const good = { sx: "126.9707", sy: "37.5547", ex: "127.0276", ey: "37.4979", deadline: String(NOW + 3600) };
const query = (overrides: Record<string, string> = {}) => new URLSearchParams({ ...good, ...overrides });

describe("parseRouteQuery", () => {
    it("올바른 값이면 숫자로 바꿔서 돌려줘요", () => {
        expect(parseRouteQuery(query(), NOW)).toEqual({
            ok: true,
            query: { start: { x: 126.9707, y: 37.5547 }, end: { x: 127.0276, y: 37.4979 }, deadline: NOW + 3600 },
        });
    });

    it("값이 빠지면 실패", () => {
        const params = query();
        params.delete("ey");
        expect(parseRouteQuery(params, NOW).ok).toBe(false);
    });

    it("빈 문자열은 0이 아니라 실패", () => {
        expect(parseRouteQuery(query({ sx: "" }), NOW).ok).toBe(false);
    });

    it("숫자가 아니면 실패", () => {
        expect(parseRouteQuery(query({ deadline: "내일" }), NOW).ok).toBe(false);
    });

    it("x, y를 뒤바꿔 보내면 서울 밖이라 실패", () => {
        expect(parseRouteQuery(query({ sx: good.sy, sy: good.sx }), NOW).ok).toBe(false);
    });

    it("마감 시각이 지금이거나 지났으면 실패", () => {
        expect(parseRouteQuery(query({ deadline: String(NOW) }), NOW).ok).toBe(false);
    });
});