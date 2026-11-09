import { describe, it, expect } from "vitest";
import {fastLimit, secondsUntil, boardingDeadline, estimateArrival, evaluateArrival, makeList, TotalRoute, ArrivalEstimate} from "./core_engine";

// 🕑 테스트용 "지금" — 엔진이 Date.now()를 직접 부르지 않으니 원하는 시각을 고정해서 넣을 수 있어요
const NOW = 1_800_000_000;

// 🚌 "도보 3분 → 740번 버스 11분 → 도보 2분" 목업 경로. 버스가 busEtaAfter초 뒤에 와요
// (여러 describe에서 같이 쓰려고 바깥으로 꺼냈어요)
const route = (busEtaAfter: number): TotalRoute => [
    { type: "walk", time: 180 },
    { type: "bus", time: 660, busNumber: "740", eta: NOW + busEtaAfter },
    { type: "walk", time: 120 },
];

describe("fastLimit", () => {
    it("도보 180초는 빠른 걸음으로 135초", () => {
        expect(fastLimit(180)).toBe(135);
    });

    it("나눠떨어지지 않으면 올림해요 (7초 → 5.25초 → 6초)", () => {
        expect(fastLimit(7)).toBe(6);
    });

    it("도보 0초는 0초", () => {
        expect(fastLimit(0)).toBe(0);
    });
});

describe("secondsUntil", () => {
    it("3분 뒤 시각까지는 180초 남아요", () => {
        expect(secondsUntil(NOW, NOW + 180)).toBe(180);
    });

    it("이미 지난 시각이면 음수예요", () => {
        expect(secondsUntil(NOW, NOW - 30)).toBe(-30);
    });
});

describe("boardingDeadline", () => {
    it("버스가 3분 뒤에 오면, 정류장엔 2분 뒤까지 가야 해요", () => {
        const busEta = NOW + 180;
        const deadline = boardingDeadline(busEta);
        expect(secondsUntil(NOW, deadline)).toBe(120);
    });
});

describe("estimateArrival", () => {
    const deadline = NOW + 18 * 60;

    it("버스가 4분 뒤에 오면 보통 걸음으로 충분해요", () => {
        const r = estimateArrival(NOW, deadline, route(240));
        expect(r).toEqual({ ok: true, arrivalAt: NOW + 1020, slack: 60, speedUps: [] });
    });

    it("버스가 3분 30초 뒤에 오면 첫 도보를 2분 30초 안에 가야 해요", () => {
        const r = estimateArrival(NOW, deadline, route(210));
        expect(r).toEqual({
            ok: true,
            arrivalAt: NOW + 990,
            slack: 90,
            speedUps: [{ segmentIndex: 0, normalTime: 180, timeLimit: 150 }],
        });
    });

    it("버스가 3분 뒤에 오면 빠른 걸음(135초)으로도 2분 안에 못 가요", () => {
        const r = estimateArrival(NOW, deadline, route(180));
        expect(r).toEqual({ ok: false, missedSegmentIndex: 1 });
    });
});

describe("evaluateArrival", () => {
    // 📝 slack만 바꿔가며 경계값을 찔러보는 도우미
    const arrived = (slack: number): ArrivalEstimate => ({ ok: true, arrivalAt: NOW, slack, speedUps: [] });

    it("여유 1분 이상이면 ahead", () => {
        expect(evaluateArrival(arrived(60))).toEqual({ evaluate: "ahead", allowTime: 60 });
    });

    it("여유 0초 ~ 59초면 tight (0초 딱 맞춤도 지각 아님)", () => {
        expect(evaluateArrival(arrived(59))?.evaluate).toBe("tight");
        expect(evaluateArrival(arrived(0))?.evaluate).toBe("tight");
    });

    it("1초 ~ 5분 늦으면 delayed", () => {
        expect(evaluateArrival(arrived(-1))?.evaluate).toBe("delayed");
        expect(evaluateArrival(arrived(-300))?.evaluate).toBe("delayed");
    });

    it("5분 넘게 늦으면 목록에서 제외 (null)", () => {
        expect(evaluateArrival(arrived(-301))).toBeNull();
    });

    it("차를 못 타는 경로도 제외 (null)", () => {
        expect(evaluateArrival({ ok: false, missedSegmentIndex: 1 })).toBeNull();
    });
});

describe("makeList", () => {
    const deadline = NOW + 18 * 60;

    it("못 타는 경로는 빼고, 도착 빠른 순으로 보여줘요", () => {
        // route(180)은 버스를 놓쳐서 빠지고, route(210)이 990초 도착으로 더 빨라요
        const r = makeList(NOW, deadline, [route(240), route(180), route(210)]);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.options.map((o) => o.arrivalAt)).toEqual([NOW + 990, NOW + 1020]);
    });

    it("카드 한 장에 경로·도착·줄일 곳·평가가 같이 묶여 있어요", () => {
        const routeB = route(210);
        const r = makeList(NOW, deadline, [routeB]);
        expect(r).toEqual({
            ok: true,
            options: [{
                route: routeB,
                arrivalAt: NOW + 990,
                speedUps: [{ segmentIndex: 0, normalTime: 180, timeLimit: 150 }],
                evaluation: { evaluate: "ahead", allowTime: 90 },
            }],
        });
    });

    it("후보가 4개여도 최대 3개만 보여줘요", () => {
        // 도착: 990(210) · 1020(240) · 1080(300) · 1140(360, 1분 지각) → 가장 늦은 1140이 잘려요
        const r = makeList(NOW, deadline, [route(360), route(240), route(300), route(210)]);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.options.map((o) => o.arrivalAt)).toEqual([NOW + 990, NOW + 1020, NOW + 1080]);
    });

    it("전부 5분 넘게 늦으면 도착 불가 + 가장 빠른 경로를 같이 줘요", () => {
        // 데드라인 10분 → 마지막 도보까지 빨리 걸어도 990초 도착, 390초(6분 30초) 지각
        const routeB = route(240);
        const r = makeList(NOW, NOW + 600, [routeB]);
        expect(r).toMatchObject({ ok: false, fastestArrivalAt: NOW + 990, lateBy: 390 });
        if (r.ok) return;
        expect(r.fastestOption?.route).toBe(routeB);
        expect(r.fastestOption?.evaluation).toEqual({ evaluate: "delayed", allowTime: -390 });
    });

    it("늦는 경로가 여러 개면 가장 빨리 도착하는 경로를 골라요", () => {
        // 도착: 1080(300) · 990(210) → route(210)이 뽑혀요
        const fast = route(210);
        const r = makeList(NOW, NOW + 600, [route(300), fast]);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.fastestOption?.route).toBe(fast);
    });

    it("탈 수 있는 경로가 아예 없으면 도착 시각·경로도 null", () => {
        const empty = { ok: false, fastestArrivalAt: null, lateBy: null, fastestOption: null };
        expect(makeList(NOW, deadline, [route(180)])).toEqual(empty);
        expect(makeList(NOW, deadline, [])).toEqual(empty);
    });
});
