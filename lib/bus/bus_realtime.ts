// 카카오 응답을 보고 → 필요한 버스 노선만 실시간 조회 → 변환기에 꽂을 EtaLookup을 만들어요 (서버에서만 사용)
//
//   kakao 응답 ──firstBusRouteIds──▶ ["100100063", …] (중복 없이, 최대 MAX_BUS_ROUTES개)
//              ──fetchBusArrivals × N (동시에)──▶ 노선 ID → 그 노선 모든 정류장 도착정보
//              ──▶ EtaLookup (버스 step이면 pickBusEta, 아니면 null)
import { EpochSeconds } from "../engine/core_engine";
import type { EtaLookup } from "../kakao/transit_convert";
import { KakaoResponse } from "../kakao/transit_types";
import { busRouteIdFor, pickBusEta } from "./bus_arrivals";
import { fetchBusArrivals } from "./bus_client";
import { BusArrivalRow } from "./bus_types";

// 💡 월 0원 운영: 한 번 길찾기에 버스 노선은 최대 이만큼만 조회해요
//    (지하철처럼 각 경로의 "첫 번째로 타는 차"만 대상. 후보 버스가 여러 대면 앞쪽부터)
export const MAX_BUS_ROUTES = 8;

export function firstBusRouteIds(res: KakaoResponse): string[] {
    if (res.status !== "OK") return [];
    const ids = new Set<string>();
    for (const route of res.routes) {
        const firstRide = route.steps.find((s) => s.properties.type !== "WALKING");
        if (firstRide?.properties.type !== "BUS") continue;
        for (const v of firstRide.properties.vehicles ?? []) {
            const id = busRouteIdFor(v.name);
            if (id) ids.add(id);
        }
    }
    return [...ids].slice(0, MAX_BUS_ROUTES);
}

// 노선별 실시간 결과로 EtaLookup 만들기 (순수 함수)
export function makeBusLookup(byRoute: Map<string, BusArrivalRow[]>, now: EpochSeconds): EtaLookup {
    return (step, earliest) => {
        const p = step.properties;
        if (p.type !== "BUS") return null;
        const vehicles = (p.vehicles ?? []).map((v) => v.name);
        const stops = (p.stops ?? []).map((s) => s.name);
        return pickBusEta(byRoute, vehicles, stops, earliest, now);
    };
}

// 실제로 불러서 EtaLookup 만들기. 실패한 노선은 빠지고 placeholder로 가요
export async function loadBusLookup(res: KakaoResponse, now: EpochSeconds): Promise<EtaLookup> {
    const ids = firstBusRouteIds(res);
    const results = await Promise.all(ids.map((id) => fetchBusArrivals(id)));

    const byRoute = new Map<string, BusArrivalRow[]>();
    results.forEach((r, i) => {
        if (r.ok) byRoute.set(ids[i], r.rows);
        else console.warn(`버스 실시간 조회 실패 (${ids[i]}):`, r.reason); // dev 서버 터미널에 찍혀요
    });
    return makeBusLookup(byRoute, now);
}
