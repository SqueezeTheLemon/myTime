import { describe, it, expect } from "vitest";
import {
    accessWalkTimes,
    distanceMeters,
    kakaoRouteToTotalRoute,
    kakaoToTotalRoutes,
    placeholderEta,
    WALK_SPEED,
    estimatedEta,
    ridesByPriority,
} from "./transit_convert";
import { makeList, BOARDING_BUFFER, fastLimit } from "../engine/core_engine";
import { okResponse, noResultResponse, realShapeResponse, REAL_START, REAL_END } from "./fixtures/kakao_sample";
import { KakaoRoute, KakaoStep } from "./transit_types";

// 🕑 엔진 테스트처럼 "지금"을 고정해요 → 네트워크도 시계도 필요 없어요
const NOW = 1_800_000_000;

describe("placeholderEta", () => {
    it("정류장 도착 시각 + 탑승 여유 60초", () => {
        expect(placeholderEta(NOW)).toBe(NOW + BOARDING_BUFFER);
    });
});

describe("kakaoRouteToTotalRoute", () => {
    it("WALKING/SUBWAY를 walk/subway로, time은 그대로 옮겨요", () => {
        const total = kakaoRouteToTotalRoute(okResponse.routes[0], NOW);
        expect(total?.map((s) => [s.type, s.time])).toEqual([
            ["walk", 300],
            ["subway", 600],
            ["subway", 900],
            ["walk", 180],
        ]);
    });

    it("eta는 시계를 굴려서 정해요 (도착 시각 + 60초)", () => {
        const total = kakaoRouteToTotalRoute(okResponse.routes[0], NOW)!;
        // 4호선: 5분 걷고 도착(NOW+300) → +60초
        expect(total[1]).toMatchObject({ lineNumber: "4호선", eta: NOW + 360 });
        // 2호선: 4호선 eta(NOW+360) + 탑승 600초 = NOW+960에 도착 → +60초
        expect(total[2]).toMatchObject({ lineNumber: "2호선", eta: NOW + 1020 });
    });

    it("vehicles 후보가 여러 개면 첫 번째 이름을 써요", () => {
        const total = kakaoRouteToTotalRoute(okResponse.routes[1], NOW)!;
        expect(total[1]).toMatchObject({ type: "bus", busNumber: "104" });
    });

    it("vehicles가 비어 있는 차 구간이 있으면 경로를 버려요", () => {
        const broken: KakaoRoute = structuredClone(okResponse.routes[1]);
        broken.steps[1].properties.vehicles = [];
        expect(kakaoRouteToTotalRoute(broken, NOW)).toBeNull();
    });

    it("모르는 step type이 오면 경로를 버려요", () => {
        const broken: KakaoRoute = structuredClone(okResponse.routes[0]);
        // 💡 타입상 불가능한 값이라 as로 억지로 넣어요. 카카오가 새 type을 추가한 상황 흉내!
        broken.steps[0].properties.type = "BICYCLE" as unknown as "WALKING";
        expect(kakaoRouteToTotalRoute(broken, NOW)).toBeNull();
    });

    it("step이 하나도 없으면 null", () => {
        const empty: KakaoRoute = { ...okResponse.routes[0], steps: [] };
        expect(kakaoRouteToTotalRoute(empty, NOW)).toBeNull();
    });
});

describe("kakaoToTotalRoutes", () => {
    it("OK면 경로마다 TotalRoute를 만들어요", () => {
        expect(kakaoToTotalRoutes(okResponse, NOW)).toHaveLength(2);
    });

    it("OK가 아니면 빈 배열", () => {
        expect(kakaoToTotalRoutes(noResultResponse, NOW)).toEqual([]);
    });

    it("버릴 경로만 빼고 나머지는 살려요", () => {
        const res = structuredClone(okResponse);
        res.routes[1].steps[1].properties.vehicles = [];
        expect(kakaoToTotalRoutes(res, NOW)).toHaveLength(1);
    });
});

// 🚶 회귀 테스트: 카카오는 처음·마지막 도보를 step으로 안 줘요 (2026-11-09 버그)
describe("처음·마지막 도보 붙이기", () => {
    const ends = { start: REAL_START, end: REAL_END };

    it("distanceMeters: 서울시청 → 서울역은 1km 남짓", () => {
        const d = distanceMeters({ x: 126.978, y: 37.5665 }, { x: 126.9707, y: 37.5547 });
        expect(d).toBeGreaterThan(1300);
        expect(d).toBeLessThan(1500);
    });

    it("ends를 주면 첫 차 앞에 도보가 붙어요 (버그 전엔 지하철만 덩그러니 나왔어요)", () => {
        const total = kakaoRouteToTotalRoute(realShapeResponse.routes[0], NOW, ends)!;
        expect(total.map((s) => s.type)).toEqual(["walk", "subway"]);
    });

    it("30초도 안 걸리는 마지막 도보(약 20m)는 붙이지 않아요", () => {
        const { after } = accessWalkTimes(realShapeResponse.routes[0], REAL_START, REAL_END);
        expect(after).toBe(0);
    });

    it("환승 경로는 도보 → 1호선 → 환승 도보 → 9호선 → 도보", () => {
        const total = kakaoRouteToTotalRoute(realShapeResponse.routes[1], NOW, ends)!;
        expect(total.map((s) => s.type)).toEqual(["walk", "subway", "walk", "subway", "walk"]);
    });

    it("빠진 거리(totalDistance - step 합)만큼을 앞뒤 직선거리 비율로 나눠 걸어요", () => {
        const route = realShapeResponse.routes[1];
        const { before, after } = accessWalkTimes(route, REAL_START, REAL_END);
        // 빠진 거리 = 24521 - (9000 + 111 + 13900) = 1510m → 보통 걸음으로 약 1373초
        expect(before + after).toBeCloseTo(1510 / WALK_SPEED, -1);
        expect(after).toBeGreaterThan(before); // 목적지 쪽이 훨씬 멀어요
    });

    it("처음 도보만큼 첫 차 eta도 늦춰져요", () => {
        const total = kakaoRouteToTotalRoute(realShapeResponse.routes[0], NOW, ends)!;
        expect(total[1]).toMatchObject({ type: "subway", eta: NOW + total[0].time + BOARDING_BUFFER });
    });

    it("ends가 없거나 정류장 좌표가 없으면 아무것도 안 붙여요", () => {
        expect(kakaoRouteToTotalRoute(realShapeResponse.routes[0], NOW)!.map((s) => s.type)).toEqual(["subway"]);
        // okResponse는 path.points가 비어 있어요
        expect(kakaoRouteToTotalRoute(okResponse.routes[0], NOW, ends)).toHaveLength(4);
    });

    it("엔진에 넣으면 도보 구간이 생겨서 '빨리 걸을 곳' 판정이 가능해져요", () => {
        // 💡 임시 eta(보통 걸음 도착 + 60초)에선 첫 도보는 서두를 일이 없어요.
        //    서두를 수 있는 건 마지막 도보(목적지까지)라서, 마지막 도보가 있는 환승 경로로 확인해요.
        const route = kakaoToTotalRoutes(realShapeResponse, NOW, ends)[1];
        const vehicles = route.filter((s) => s.type !== "walk").length;
        // 데드라인을 빠듯하게: 보통 걸음으론 1분 늦게 도착
        const normal = route.reduce((t, s) => t + s.time, 0) + vehicles * BOARDING_BUFFER;
        const result = makeList(NOW, NOW + normal - 60, [route]);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.options[0].speedUps.map((s) => s.segmentIndex)).toEqual([route.length - 1]);
    });
});

// 🔗 입구 → 엔진까지 이어 붙여 보기
describe("변환 결과를 엔진에 넣으면", () => {
    it("임시 eta에선 빠른 걸음 없이, 대기 1분씩만 하고 도착해요", () => {
        const routes = kakaoToTotalRoutes(okResponse, NOW);
        const result = makeList(NOW, NOW + 3600, routes);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // 경로 0: 300 + 60 + 600 + 60 + 900 + 180 = 2100초
        expect(result.options[0].arrivalAt).toBe(NOW + 2100);
        expect(result.options[0].speedUps).toEqual([]);
    });
});
describe("실시간 eta 꽂기 (EtaLookup)", () => {
    const route = okResponse.routes![0]; // 도보 300 → 4호선 600 → 2호선 900 → 도보 180

    it("빠른 걸음 기준 가장 이른 시각을 넘겨주고, 모르면 placeholder로 대신한다", () => {
        const asked: number[] = [];
        const etaFor = (_step: unknown, at: { earliest: number }) => {
            asked.push(at.earliest);
            return asked.length === 1 ? { eta: NOW + 400 } : null; // 첫 차만 실시간, 환승은 모름
        };
        const total = kakaoRouteToTotalRoute(route, NOW, undefined, etaFor)!;

        expect(asked[0]).toBe(NOW + fastLimit(300)); // 300초 도보를 빨리 걸으면 225초
        expect(total[1]).toMatchObject({ type: "subway", eta: NOW + 400 });
        // 환승 열차: 첫 차 eta + 탑승 600초 시점에 placeholder
        expect(total[2]).toMatchObject({ type: "subway", eta: placeholderEta(NOW + 400 + 600) });
    });

    it("빨리 걸어야만 탈 수 있는 열차를 고르면 엔진이 '빨리 걸으세요'를 낸다", () => {
        // 보통 걸음(300초)으론 못 닿고, 빠른 걸음(225초)으론 닿는 열차
        let calls = 0;
        const etaFor = () => (++calls === 1 ? { eta: NOW + fastLimit(300) + BOARDING_BUFFER } : null); // 환승은 placeholder
        const total = kakaoRouteToTotalRoute(route, NOW, undefined, etaFor)!;
        const result = makeList(NOW, NOW + 3 * 3600, [total]);
        expect(result.ok && result.options[0].speedUps[0]).toMatchObject({ segmentIndex: 0, normalTime: 300 });
    });
});

describe("실시간이 고른 차 이름", () => {
    it("후보 버스 중 실시간이 고른 버스 번호로 바꿔 넣는다", () => {
        const busRoute = okResponse.routes![1]; // 104 / 463 / N16(심야) 중 하나
        const total = kakaoRouteToTotalRoute(busRoute, NOW, undefined, () => ({ eta: NOW + 600, vehicle: "463" }))!;
        expect(total.find((s) => s.type === "bus")).toMatchObject({ busNumber: "463", eta: NOW + 600 });
    });
});

describe("환승 차에도 실시간·어림 적용", () => {
    // 도보 100 → 지하철A 300 → 환승 도보 200 → 지하철B 600
    const step = (type: "WALKING" | "SUBWAY", time: number, name = ""): KakaoStep => ({
        properties: { guidance: "", type, distance: 0, time, stops: [], vehicles: name ? [{ name, type: "일반" }] : [] },
        path: { points: [] },
    });
    const transferRoute: KakaoRoute = {
        properties: { type: "SUBWAY", totalDistance: 0, totalTime: 0, transfers: 1 },
        steps: [step("WALKING", 100), step("SUBWAY", 300, "A"), step("WALKING", 200), step("SUBWAY", 600, "B")],
    };
    const deadline = NOW + 3 * 3600;

    it("환승 도보를 빨리 걸어야만 탈 수 있는 실시간 열차면 환승 도보에 speedUp이 생긴다", () => {
        const seen: { clock: number; earliest: number }[] = [];
        const etaFor = (_s: KakaoStep, at: { clock: number; earliest: number }) => {
            seen.push(at);
            // A는 바로 탈 수 있게, B는 "빠른 걸음 도착 + 1분"에 오는 실시간 열차
            return seen.length === 1 ? { eta: NOW + 200 } : { eta: at.earliest + BOARDING_BUFFER };
        };
        const total = kakaoRouteToTotalRoute(transferRoute, NOW, undefined, etaFor)!;

        // 앞 차 eta(200) + 탑승 300 = 500에서 환승 도보 시작 → 보통 700, 빠른 걸음 650
        expect(seen[1]).toEqual({ clock: NOW + 700, earliest: NOW + 500 + fastLimit(200) });
        const result = makeList(NOW, deadline, [total]);
        expect(result.ok && result.options[0].speedUps).toEqual([
            { segmentIndex: 2, normalTime: 200, timeLimit: fastLimit(200) },
        ]);
    });

    it("어림값(보통 걸음 기준 + 배차/2)으로 고른 차에는 빨리 걷기 안내가 없다", () => {
        let calls = 0;
        const etaFor = (_s: KakaoStep, at: { clock: number }) =>
            ++calls === 1 ? { eta: NOW + 200 } : { eta: estimatedEta(at.clock, 600), estimated: true };
        const total = kakaoRouteToTotalRoute(transferRoute, NOW, undefined, etaFor)!;

        expect(total[3]).toMatchObject({ eta: NOW + 700 + 300 }); // 배차 10분 → 평균 5분 대기
        const result = makeList(NOW, deadline, [total]);
        expect(result.ok && result.options[0].speedUps).toEqual([]);
    });

    it("배차가 짧아도 어림 대기는 최소 탑승 여유(1분)", () => {
        expect(estimatedEta(NOW, 60)).toBe(NOW + BOARDING_BUFFER);
    });
});

describe("ridesByPriority — 조회 순서", () => {
    it("모든 경로의 첫 차를 먼저, 환승 차는 그 뒤에", () => {
        const names = ridesByPriority(okResponse).map((s) => s.properties.vehicles[0].name);
        // 경로1: 4호선 → 2호선, 경로2: 104 → 첫 차(4호선, 104) 다음에 환승(2호선)
        expect(names).toEqual(["4호선", "104", "2호선"]);
    });
});
