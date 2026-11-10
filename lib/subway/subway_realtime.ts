// 카카오 응답을 보고 → 필요한 역만 실시간 조회 → 변환기에 꽂을 EtaLookup을 만들어요 (서버에서만 사용)
//
//   kakao 응답 ──firstSubwayStations──▶ ["서울", "충무로", …] (중복 없이)
//              ──fetchSubwayArrivals × N (동시에)──▶ 역 이름 → TrainArrival[]
//              ──▶ EtaLookup (지하철 step이면 pickSubwayEta, 아니면 null)
import { EpochSeconds } from "../engine/core_engine";
import type { EtaLookup } from "../kakao/transit_convert";
import { KakaoResponse } from "../kakao/transit_types";
import { fetchSubwayArrivals } from "./subway_client";
import { normalizeStation, pickSubwayEta, toArrivals, TrainArrival } from "./subway_arrivals";

// 💡 월 0원 운영이라 호출 수를 아껴요.
//    실시간 목록은 방향마다 열차 2대(약 10분 앞)까지만 보여줘서, 환승역처럼 한참 뒤에 닿는 역은 조회해도 거의 못 써요.
//    그래서 각 경로의 "첫 번째로 타는 차"가 지하철일 때 그 역만 조회해요.
export function firstSubwayStations(res: KakaoResponse): string[] {
    if (res.status !== "OK") return [];
    const names = new Set<string>();
    for (const route of res.routes) {
        const firstRide = route.steps.find((s) => s.properties.type !== "WALKING");
        const stop = firstRide?.properties.stops?.[0]?.name;
        if (firstRide?.properties.type === "SUBWAY" && stop) names.add(normalizeStation(stop));
    }
    return [...names];
}

// 역별 실시간 결과로 EtaLookup 만들기 (순수 함수 — 테스트하기 쉬워요)
export function makeSubwayLookup(byStation: Map<string, TrainArrival[]>): EtaLookup {
    return (step, earliest) => {
        const p = step.properties;
        if (p.type !== "SUBWAY") return null;
        const stops = (p.stops ?? []).map((s) => s.name);
        const arrivals = stops[0] ? byStation.get(normalizeStation(stops[0])) : undefined;
        if (!arrivals) return null; // 조회 안 한 역(환승역 등) → placeholder
        const eta = pickSubwayEta(arrivals, p.vehicles[0].name, stops, earliest);
        return eta === null ? null : { eta };
    };
}

// 실제로 불러서 EtaLookup 만들기
// ⚠️ 실시간이 실패해도 길찾기 자체는 계속돼야 해요 → 실패한 역은 그냥 빠지고 placeholder로 가요
export async function loadSubwayLookup(res: KakaoResponse, now: EpochSeconds): Promise<EtaLookup> {
    const stations = firstSubwayStations(res);
    const results = await Promise.all(stations.map((name) => fetchSubwayArrivals(name)));

    const byStation = new Map<string, TrainArrival[]>();
    results.forEach((r, i) => {
        if (r.ok) byStation.set(stations[i], toArrivals(r.rows, now));
        else console.warn(`지하철 실시간 조회 실패 (${stations[i]}):`, r.reason); // dev 서버 터미널에 찍혀요
    });
    return makeSubwayLookup(byStation);
}
