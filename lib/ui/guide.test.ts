import { describe, expect, it } from "vitest";
import type { RouteOption } from "../engine/core_engine";
import { parseGuideSession, pendingTime, stepGuide, stepLabel, walkTarget, withJosa } from "./guide";

// 💡 2026-11-05 14:00 현지 시각을 기준으로 잡아요
const T = Math.floor(new Date(2026, 10, 5, 14, 0).getTime() / 1000);
const min = (m: number) => m * 60;

// 도보 3분 → 740번 버스(14:05 도착) 11분 → 도보 2분, 데드라인 14:30
const option: RouteOption = {
    route: [
        { type: "walk", time: min(3) },
        { type: "bus", time: min(11), busNumber: "740", eta: T + min(5) },
        { type: "walk", time: min(2) },
    ],
    arrivalAt: T + min(18),
    speedUps: [],
    evaluation: { evaluate: "ahead", allowTime: min(12) },
};
const deadline = T + min(30);

describe("parseGuideSession", () => {
    const valid = { version: 1, option, deadline, destName: "서울역", routesQuery: "sx=1", step: 1 };

    it("올바른 값은 그대로 돌려줘요", () => {
        expect(parseGuideSession(JSON.stringify(valid))).toEqual(valid);
    });

    it("없거나 깨졌거나 모양이 다르면 null", () => {
        expect(parseGuideSession(null)).toBeNull();
        expect(parseGuideSession("{")).toBeNull();
        expect(parseGuideSession(JSON.stringify({ ...valid, version: 2 }))).toBeNull();
        expect(parseGuideSession(JSON.stringify({ ...valid, option: { ...option, route: [] } }))).toBeNull();
        expect(parseGuideSession(JSON.stringify({ ...valid, option: { ...option, route: [{ type: "taxi", time: 1 }] } }))).toBeNull();
    });

    it("단계 번호는 0 ~ 구간 수 안으로 맞춰요", () => {
        expect(parseGuideSession(JSON.stringify({ ...valid, step: 99 }))?.step).toBe(3);
        expect(parseGuideSession(JSON.stringify({ ...valid, step: -1 }))?.step).toBe(0);
    });
});

describe("withJosa", () => {
    it("받침 있으면 을, 없으면 를", () => {
        expect(withJosa("지하철 4호선", "을", "를")).toBe("지하철 4호선을");
        expect(withJosa("740번 버스", "을", "를")).toBe("740번 버스를");
    });
});

describe("단계 정보", () => {
    it("목록 이름: 도보는 가는 곳, 차는 이름과 시간", () => {
        expect(stepLabel(option.route, 0, "서울역")).toBe("도보 3분 · 정류장까지");
        expect(stepLabel(option.route, 1, "서울역")).toBe("740번 버스 11분");
        expect(stepLabel(option.route, 2, "서울역")).toBe("도보 2분 · 서울역까지");
    });

    it("도보 마감: 다음 차 도착 1분 전, 마지막이면 데드라인", () => {
        expect(walkTarget(option.route, 0, deadline)).toBe(T + min(4));
        expect(walkTarget(option.route, 2, deadline)).toBe(deadline);
    });

    it("대기 단계 시각: 차는 탑승, 마지막은 도착", () => {
        expect(pendingTime(option, 0)).toBe("");
        expect(pendingTime(option, 1)).toBe("2:05 탑승");
        expect(pendingTime(option, 2)).toBe("2:18 도착");
    });
});

describe("stepGuide", () => {
    it("차 타러 가는 도보: 탑승 1분 전까지 남은 시간", () => {
        // 14:00 → 마감 14:04, 4분 남음 (도보 3분이라 보통 걸음으로 충분)
        const g = stepGuide(option, 0, deadline, "서울역", T);
        expect(g.instruction).toBe("4분 안에 정류장에 도착하세요");
        expect(g.detail).not.toContain("빨리");
    });

    it("남은 시간이 도보 시간보다 짧으면 빨리 걸으라고 알려요", () => {
        const g = stepGuide(option, 0, deadline, "서울역", T + min(1) + 30);
        expect(g.instruction).toBe("2분 30초 안에 정류장에 도착하세요");
        expect(g.detail).toContain("빨리");
    });

    it("탑승 시각이 지나면 서두르라고 해요", () => {
        expect(stepGuide(option, 0, deadline, "서울역", T + min(5)).instruction).toBe("서둘러 정류장에 가세요");
    });

    it("차 구간: 이름 + 조사, 내린 뒤 도보", () => {
        const g = stepGuide(option, 1, deadline, "서울역", T);
        expect(g.instruction).toBe("740번 버스를 타세요");
        expect(g.detail).toBe("2:05쯤 오는 버스예요. 11분 동안 타고 가요. 내린 뒤 도보 2분이에요.");
    });

    it("마지막 도보: 도착지까지", () => {
        expect(stepGuide(option, 2, deadline, "서울역", T).instruction).toBe("서울역까지 2분 걸어가세요");
    });
});
