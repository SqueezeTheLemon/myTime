// 카카오 응답을 보고 → 필요한 역만 실시간 조회 → 변환기에 꽂을 EtaLookup을 만들어요 (서버에서만 사용)
//
//   kakao 응답 ──subwayStations──▶ ["서울", "충무로", …] (첫 차 역 먼저, 그다음 환승역 / 중복 없이 / 최대 12곳)
//              ──fetchSubwayArrivals × N (동시에)──▶ 역 이름 → TrainArrival[]
//              ──▶ EtaLookup (지하철 step이면 pickSubway, 아니면 null)
import { EpochSeconds } from "../engine/core_engine";
import { EtaLookup, ridesByPriority } from "../kakao/transit_convert";
import { KakaoResponse } from "../kakao/transit_types";
import { fetchSubwayArrivals } from "./subway_client";
import { normalizeStation, pickSubway, toArrivals, TrainArrival } from "./subway_arrivals";

// 💡 월 0원 운영: 길찾기 1회에 지하철 역은 최대 이만큼만 조회해요 (역 1곳 = 호출 1번)
//    넘치면 첫 차 역을 먼저 채우고, 남는 자리에 환승역을 넣어요. 잘린 역의 열차는 placeholder로 가요
export const MAX_SUBWAY_STATIONS = 12;

export function subwayStations(res: KakaoResponse): string[] {
    const names = new Set<string>();
    for (const step of ridesByPriority(res)) {
        const stop = step.properties.stops?.[0]?.name;
        if (step.properties.type === "SUBWAY" && stop) names.add(normalizeStation(stop));
    }
    return [...names].slice(0, MAX_SUBWAY_STATIONS);
}

// 역별 실시간 결과로 EtaLookup 만들기 (순수 함수 — 테스트하기 쉬워요)
export function makeSubwayLookup(byStation: Map<string, TrainArrival[]>): EtaLookup {
    return (step, at) => {
        const p = step.properties;
        if (p.type !== "SUBWAY") return null;
        const stops = (p.stops ?? []).map((s) => s.name);
        const arrivals = stops[0] ? byStation.get(normalizeStation(stops[0])) : undefined;
        if (!arrivals) return null; // 조회 안 한(또는 실패한) 역 → placeholder
        return pickSubway(arrivals, p.vehicles[0].name, stops, at);
    };
}

// 실제로 불러서 EtaLookup 만들기
// ⚠️ 실시간이 실패해도 길찾기 자체는 계속돼야 해요 → 실패한 역은 그냥 빠지고 placeholder로 가요
export async function loadSubwayLookup(res: KakaoResponse, now: EpochSeconds): Promise<EtaLookup> {
    const stations = subwayStations(res);
    const results = await Promise.all(stations.map((name) => fetchSubwayArrivals(name)));

    const byStation = new Map<string, TrainArrival[]>();
    results.forEach((r, i) => {
        if (r.ok) byStation.set(stations[i], toArrivals(r.rows, now));
        else console.warn(`지하철 실시간 조회 실패 (${stations[i]}):`, r.reason); // dev 서버 터미널에 찍혀요
    });
    return makeSubwayLookup(byStation);
}
