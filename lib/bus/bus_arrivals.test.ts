import { describe, it, expect } from "vitest";
import { busEtasAtStop, busRouteIdFor, pickBusEta, rowEtas } from "./bus_arrivals";
import { BUS_SAMPLE_NOW, kakaoStops402, rows402 } from "./fixtures/bus_sample";
import { BOARDING_BUFFER } from "../engine/core_engine";
import { STALE_LIMIT } from "../subway/subway_arrivals";

const NOW = BUS_SAMPLE_NOW;
const ID_402 = "100100063";

describe("busRouteIdFor — 카카오 번호 → 노선 ID", () => {
    it("심야 꼬리표를 떼고 찾는다", () => {
        expect(busRouteIdFor("402")).toBe(ID_402);
        expect(busRouteIdFor("N75(심야)")).toBe(busRouteIdFor("N75"));
        expect(busRouteIdFor("N75")).not.toBeNull();
    });

    it("서울 노선이 아니면 null (→ placeholder)", () => {
        expect(busRouteIdFor("9300")).toBeNull();
    });
});

describe("rowEtas — 한 정류장의 두 대", () => {
    it("초 값으로 두 대의 도착 시각을 만든다", () => {
        expect(rowEtas(rows402[4], NOW)).toEqual([NOW + 431, NOW + 984]); // 서울역버스환승센터
    });

    it("차고지 출발대기 버스는 믿지 않는다", () => {
        expect(rowEtas(rows402[1], NOW)).toEqual([NOW + 29]); // 1번째는 출발대기, 2번째만
    });

    it("오래된 정보는 버린다", () => {
        expect(rowEtas(rows402[4], NOW + STALE_LIMIT + 1)).toEqual([]);
    });
});

describe("busEtasAtStop — 카카오 정류장 찾기", () => {
    it("괄호를 뗀 이름 + 다음 정류장으로 같은 방향 정류장을 찾는다", () => {
        expect(busEtasAtStop(rows402, kakaoStops402, NOW)).toEqual([NOW + 431, NOW + 984]);
    });

    it("이름이 같은 정류장이 둘이면 다음 정류장이 맞는 쪽을 고른다", () => {
        // 길 건너편(반대 방향) 정류장이 같은 이름으로 하나 더 있다고 해 봐요
        const opposite = { ...rows402[4], staOrd: "90", exps1: "10", exps2: "20" };
        const after = { ...rows402[3], staOrd: "91" }; // 반대 방향의 다음 = 시청역8번출구
        const rows = [...rows402, opposite, after];
        expect(busEtasAtStop(rows, kakaoStops402, NOW)).toEqual([NOW + 431, NOW + 984]);
    });

    it("노선에 없는 정류장이면 빈 목록", () => {
        expect(busEtasAtStop(rows402, ["없는정류장", "어딘가"], NOW)).toEqual([]);
    });
});

describe("pickBusEta — 후보 버스 중 탈 수 있는 가장 빠른 것", () => {
    const byRoute = new Map([[ID_402, rows402]]);

    it("시간 안에 닿는 가장 빠른 버스와 그 번호", () => {
        expect(pickBusEta(byRoute, ["402"], kakaoStops402, NOW, NOW)).toEqual({ eta: NOW + 431, vehicle: "402" });
    });

    it("첫 버스를 못 타면 다음 버스", () => {
        const earliest = NOW + 431 - BOARDING_BUFFER + 1;
        expect(pickBusEta(byRoute, ["402"], kakaoStops402, earliest, NOW)?.eta).toBe(NOW + 984);
    });

    it("여러 후보 중 더 빨리 오는 버스를 고른다", () => {
        const id9 = busRouteIdFor("N16")!;
        const faster = rows402.map((r) => ({ ...r, busRouteId: id9, rtNm: "N16", exps1: "200", exps2: "0", arrmsg2: "운행종료" }));
        const both = new Map([[ID_402, rows402], [id9, faster]]);
        expect(pickBusEta(both, ["402", "N16(심야)"], kakaoStops402, NOW, NOW)).toEqual({ eta: NOW + 200, vehicle: "N16(심야)" });
    });

    it("조회 안 한 노선뿐이면 null", () => {
        expect(pickBusEta(byRoute, ["9300"], kakaoStops402, NOW, NOW)).toBeNull();
    });
});
