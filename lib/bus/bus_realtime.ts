// 카카오 응답을 보고 → 필요한 버스 노선만 실시간 조회 → 변환기에 꽂을 EtaLookup을 만들어요 (서버에서만 사용)
//
//   kakao 응답 ──busRouteIds──▶ ["100100063", …] (첫 차 노선 먼저, 그다음 환승 노선 / 중복 없이 / 최대 12개)
//              ──fetchBusArrivals × N (동시에)──▶ 노선 ID → 그 노선 모든 정류장 도착정보
//              ──▶ EtaLookup (버스 step이면 pickBus, 아니면 null)
import { EpochSeconds } from "../engine/core_engine";
import { EtaLookup, ridesByPriority } from "../kakao/transit_convert";
import { KakaoResponse } from "../kakao/transit_types";
import { busRouteIdFor, pickBus } from "./bus_arrivals";
import { fetchBusArrivals } from "./bus_client";
import { BusArrivalRow } from "./bus_types";

// 💡 월 0원 운영: 길찾기 1회에 버스 노선은 최대 이만큼만 조회해요 (노선 1개 = 호출 1번, 모든 정류장이 같이 와요)
//    넘치면 첫 차 노선을 먼저 채우고, 남는 자리에 환승 노선을 넣어요. 잘린 노선은 placeholder로 가요
export const MAX_BUS_ROUTES = 12;

export function busRouteIds(res: KakaoResponse): string[] {
    const ids = new Set<string>();
    for (const step of ridesByPriority(res)) {
        if (step.properties.type !== "BUS") continue;
        for (const v of step.properties.vehicles ?? []) {
            const id = busRouteIdFor(v.name);
            if (id) ids.add(id);
        }
    }
    return [...ids].slice(0, MAX_BUS_ROUTES);
}

// 노선별 실시간 결과로 EtaLookup 만들기 (순수 함수)
export function makeBusLookup(byRoute: Map<string, BusArrivalRow[]>, now: EpochSeconds): EtaLookup {
    return (step, at) => {
        const p = step.properties;
        if (p.type !== "BUS") return null;
        const vehicles = (p.vehicles ?? []).map((v) => v.name);
        const stops = (p.stops ?? []).map((s) => s.name);
        return pickBus(byRoute, vehicles, stops, at, now);
    };
}

// 실제로 불러서 EtaLookup 만들기. 실패한 노선은 빠지고 placeholder로 가요
export async function loadBusLookup(res: KakaoResponse, now: EpochSeconds): Promise<EtaLookup> {
    const ids = busRouteIds(res);
    const results = await Promise.all(ids.map((id) => fetchBusArrivals(id)));

    const byRoute = new Map<string, BusArrivalRow[]>();
    results.forEach((r, i) => {
        if (r.ok) byRoute.set(ids[i], r.rows);
        else console.warn(`버스 실시간 조회 실패 (${ids[i]}):`, r.reason); // dev 서버 터미널에 찍혀요
    });
    return makeBusLookup(byRoute, now);
}
