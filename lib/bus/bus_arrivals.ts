// 버스 실시간 응답 → "이 정류장에 이 버스가 언제 오나" (순수 함수만, 네트워크 없음)
//
// 큰 흐름 (지하철과 비슷해요)
//   카카오 버스 번호 "N75(심야)" ──busRouteIdFor──▶ 노선 ID (미리 만든 표)
//   노선 전체 도착정보 + 카카오 정류장(탈 곳, 다음 곳) ──busEtasAtStop──▶ 이 정류장 도착 시각들
//   여러 후보 버스 ──pickBus──▶ 실시간 { eta, vehicle } → 범위 밖이면 배차 어림 → 못 맞추면 null
import { BOARDING_BUFFER, EpochSeconds, Seconds } from "../engine/core_engine";
import { ArrivalAt, EtaPick, estimatedEta } from "../kakao/transit_convert";
import { parseKst, STALE_LIMIT } from "../subway/subway_arrivals";
import { BusArrivalRow } from "./bus_types";
import routeIds from "./bus_route_ids.json"; // scripts/build_bus_route_ids.mjs로 만든 표

// 번호 → { 노선 ID, 배차 간격(분) }
const ROUTES: Record<string, { id: string; term: number | null }> = routeIds;
// 표에 배차 간격이 없는 노선(약 110개)의 가정값
export const DEFAULT_BUS_HEADWAY: Seconds = 600;

// "N75(심야)" → "N75" (카카오는 꼬리표를 붙이지만, 서울 API 노선 이름엔 없어요)
export function normalizeBusName(name: string): string {
    return name.replace(/\(.*?\)/g, "").trim();
}

// 카카오 버스 번호 → 서울 노선 ID. 서울 노선이 아니면(경기 9300 등) null
export function busRouteIdFor(name: string): string | null {
    return ROUTES[normalizeBusName(name)]?.id ?? null;
}

// 카카오 버스 번호 → 배차 간격(초)
export function busHeadway(name: string): Seconds {
    const term = ROUTES[normalizeBusName(name)]?.term;
    return term ? term * 60 : DEFAULT_BUS_HEADWAY;
}

// "서울역버스환승센터(5번승강장)(중)" → "서울역버스환승센터"
// 💡 괄호 안(승강장·중앙차로 표시)과 공백을 떼면 카카오와 서울 API 이름이 같아져요 (실측)
export function normalizeBusStop(name: string): string {
    return name.replace(/\(.*?\)/g, "").replace(/\s/g, "");
}

// 응답 한 줄의 두 대(1번째, 2번째) → 도착 시각들
// "출발대기"(차고지에서 대기)·"운행종료"는 숫자를 믿을 수 없어서 빼요
export function rowEtas(row: BusArrivalRow, now: EpochSeconds): EpochSeconds[] {
    const made = parseKst(row.mkTm.slice(0, 19)); // ".0" 꼬리를 떼면 지하철과 같은 모양
    if (made === null || now - made > STALE_LIMIT) return [];
    const base = Math.min(made, now); // 미래 시각이 와도 지금 기준

    const etas: EpochSeconds[] = [];
    for (const [exps, msg] of [[row.exps1, row.arrmsg1], [row.exps2, row.arrmsg2]]) {
        if (msg.includes("출발대기") || msg.includes("운행종료")) continue;
        const sec = Number(exps);
        if (Number.isFinite(sec) && sec > 0) etas.push(base + sec);
        else if (msg.includes("곧 도착")) etas.push(base); // 초 값이 없으면 "지금"으로 (놓치지 않는 쪽)
    }
    return etas;
}

// 노선 전체 줄 중에서 "카카오가 말한 그 정류장(그 방향)"을 찾아 도착 시각들을 돌려줘요
// 💡 길 건너편 정류장은 이름이 같을 때가 많아서, "다음 정류장 이름"까지 맞아야 같은 방향으로 봐요
export function findStopRow(rows: BusArrivalRow[], stops: string[]): BusArrivalRow | undefined {
    if (stops.length === 0) return undefined;
    const board = normalizeBusStop(stops[0]);
    const next = stops[1] ? normalizeBusStop(stops[1]) : null;

    const byOrder = new Map(rows.map((r) => [Number(r.staOrd), r]));
    const candidates = rows.filter((r) => normalizeBusStop(r.stNm) === board);

    const sameWay = candidates.find((r) => {
        const after = byOrder.get(Number(r.staOrd) + 1);
        return next !== null && after !== undefined && normalizeBusStop(after.stNm) === next;
    });
    // 다음 정류장으로 못 가렸어도, 이름이 노선에 딱 한 번 나오면 그걸 믿어요
    return sameWay ?? (candidates.length === 1 ? candidates[0] : undefined);
}

export function busEtasAtStop(rows: BusArrivalRow[], stops: string[], now: EpochSeconds): EpochSeconds[] {
    const row = findStopRow(rows, stops);
    return row ? rowEtas(row, now) : [];
}

// 후보 버스들("104", "463", "N16(심야)" — 아무거나 타도 되는 버스) 중 탈 수 있는 가장 빠른 것 (실시간만)
//   byRoute: 노선 ID → 그 노선의 도착정보 줄 (조회 안 한 노선은 없음)
export function pickBusEta(
    byRoute: Map<string, BusArrivalRow[]>,
    vehicles: string[],
    stops: string[],
    earliest: EpochSeconds,
    now: EpochSeconds,
): { eta: EpochSeconds; vehicle: string } | null {
    let best: { eta: EpochSeconds; vehicle: string } | null = null;
    for (const vehicle of vehicles) {
        const id = busRouteIdFor(vehicle);
        const rows = id ? byRoute.get(id) : undefined;
        if (!rows) continue;
        for (const eta of busEtasAtStop(rows, stops, now)) {
            if (eta - BOARDING_BUFFER < earliest) continue; // 시간 안에 못 가요
            if (!best || eta < best.eta) best = { eta, vehicle };
        }
    }
    return best;
}

// 실시간 → 범위 밖이면 배차 어림 → 못 맞추면 null(placeholder)
//   실시간은 at.earliest(빠른 걸음) 기준, 어림값은 at.clock(보통 걸음) 기준이에요
export function pickBus(
    byRoute: Map<string, BusArrivalRow[]>,
    vehicles: string[],
    stops: string[],
    at: ArrivalAt,
    now: EpochSeconds,
): EtaPick | null {
    const real = pickBusEta(byRoute, vehicles, stops, at.earliest, now);
    if (real) return real;

    // 정류장을 맞춘 후보 버스 중 배차가 가장 짧은 버스로 어림해요 (운행종료면 제외)
    let best: { vehicle: string; headway: Seconds } | null = null;
    for (const vehicle of vehicles) {
        const id = busRouteIdFor(vehicle);
        const row = id ? findStopRow(byRoute.get(id) ?? [], stops) : undefined;
        if (!row || (row.arrmsg1.includes("운행종료") && row.arrmsg2.includes("운행종료"))) continue;
        const headway = busHeadway(vehicle);
        if (!best || headway < best.headway) best = { vehicle, headway };
    }
    return best ? { eta: estimatedEta(at.clock, best.headway), vehicle: best.vehicle, estimated: true } : null;
}
