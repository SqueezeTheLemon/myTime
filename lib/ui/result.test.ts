import { describe, expect, it } from "vitest";
import type { TotalRoute } from "../engine/core_engine";
import { arrivalResult, lateMessage, recalcBanner, recalcQuery, routeSummary, totalTravel } from "./result";

// 💡 2026-11-05 14:16 현지 시각
const T = Math.floor(new Date(2026, 10, 5, 14, 16).getTime() / 1000);
const min = (m: number) => m * 60;

describe("recalcQuery", () => {
    const original = "sx=1&sy=2&ex=127&ey=37.5&deadline=100&dest=%EC%84%9C%EC%9A%B8%EC%97%AD";

    it("출발지만 지금 위치로 바꾸고 이유·시각을 붙여요", () => {
        const p = new URLSearchParams(recalcQuery(original, { x: 126.9, y: 37.55 }, "missed-bus", T));
        expect(p.get("sx")).toBe("126.9");
        expect(p.get("sy")).toBe("37.55");
        expect(p.get("ex")).toBe("127");
        expect(p.get("deadline")).toBe("100");
        expect(p.get("dest")).toBe("서울역");
        expect(p.get("reason")).toBe("missed-bus");
        expect(p.get("at")).toBe(String(T));
    });

    it("이유가 없으면 예전 이유를 지워요", () => {
        const p = new URLSearchParams(recalcQuery(`${original}&reason=delay`, { x: 1, y: 2 }, null, T));
        expect(p.has("reason")).toBe(false);
    });
});

describe("recalcBanner", () => {
    it("이유와 시각으로 띠 문구를 만들어요", () => {
        expect(recalcBanner("missed-bus", String(T))).toBe("버스를 놓쳐서 2:16에 다시 계산했어요");
    });

    it("모르는 이유면 시각만", () => {
        expect(recalcBanner("hack", String(T))).toBe("2:16에 다시 계산했어요");
    });

    it("다시 계산한 게 아니면 null", () => {
        expect(recalcBanner(null, null)).toBeNull();
        expect(recalcBanner("missed-bus", "abc")).toBeNull();
    });
});

describe("lateMessage", () => {
    it("늦는 분은 올림", () => {
        expect(lateMessage(T + min(20), min(5) + 10)).toBe("6분 정도 늦을 것 같아요. 오후 2:36쯤 도착해요. 죄송합니다.");
    });
});

describe("arrivalResult", () => {
    it("데드라인 전이면 제시간 + 여유", () => {
        expect(arrivalResult(T, T + min(2) + 30)).toEqual({ onTime: true, title: "제시간에 도착했어요", diffLabel: "여유", diffValue: "2분" });
    });

    it("데드라인을 넘기면 늦음 (올림)", () => {
        expect(arrivalResult(T + min(2) + 1, T)).toMatchObject({ onTime: false, title: "3분 늦게 도착했어요", diffValue: "3분" });
    });
});

describe("이동 요약", () => {
    const route: TotalRoute = [
        { type: "walk", time: min(3) },
        { type: "bus", time: min(11), busNumber: "740", eta: T },
        { type: "walk", time: min(4) },
    ];

    it("구간을 화살표로 이어요", () => {
        expect(routeSummary(route)).toBe("도보 3분 → 740번 버스 11분 → 도보 4분");
    });

    it("실제 걸린 시간을 알면 그걸, 모르면 구간 합", () => {
        expect(totalTravel(route, T, T + min(20))).toBe("20분");
        expect(totalTravel(route)).toBe("18분");
    });
});
