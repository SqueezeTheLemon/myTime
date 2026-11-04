import { describe, it, expect } from "vitest";
import { kakaoRouteToTotalRoute, kakaoToTotalRoutes, placeholderEta } from "./kakao_convert";
import { makeList, BOARDING_BUFFER } from "./core_engine";
import { okResponse, noResultResponse } from "./fixtures/kakao_sample";
import { KakaoRoute } from "./kakao_types";

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