// 카카오 응답 -> 엔진이 이해할 수 있는 Total Route로 바꾸기
import { BOARDING_BUFFER, EpochSeconds, fastLimit, RouteSegment, Seconds, TotalRoute } from "../engine/core_engine";
import type { Point } from "../routes/route_query";
import { KakaoResponse, KakaoRoute, KakaoStep } from "./transit_types";

// 일단, 정류장에 도착하고 딱 탑승 여유(boarding buffer)만큼 지나면 차가 온다고 가정 - 차를 놓치는 경우의 수는 나중에 생각
export function placeholderEta(arrivalAtStop : EpochSeconds): EpochSeconds{
    return arrivalAtStop + BOARDING_BUFFER;
}

// ─────────────────────────────────────────────────────────────
// 🚶 처음·마지막 도보 (2026-11-09 실측으로 확인)
// 카카오 steps에는 "환승 도보"만 WALKING으로 오고,
// 출발지 → 첫 정류장, 마지막 정류장 → 목적지 도보는 아예 없어요.
// 대신 route.properties.totalDistance에는 그 거리까지 포함돼 있어요.
//   → 빠진 거리 = totalDistance - (step 거리 합)
//   → 앞/뒤 직선거리 비율로 나누고, 보통 걸음 속도로 시간으로 바꿔요.
// ─────────────────────────────────────────────────────────────
export const WALK_SPEED = 1.1; // m/s ≈ 시속 4km 보통 걸음 (카카오 환승 도보는 계단 포함이라 더 느려서 따로 정했어요)
export const MIN_ACCESS_WALK: Seconds = 30; // 30초도 안 걸리면 "도보" 칩으로 보여줄 의미가 없어요
const MAX_DETOUR = 2; // 실제 길이 직선의 2배를 넘는다면 데이터가 이상한 걸로 보고 2배까지만 믿어요

// 두 좌표 사이 직선거리(m). 하버사인 공식: 지구를 둥근 공으로 보고 재요
export function distanceMeters(a: Point, b: Point): number {
    const R = 6_371_000;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = rad(b.y - a.y);
    const dLon = rad(b.x - a.x);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.y)) * Math.cos(rad(b.y)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// path.points의 한 점 [경도, 위도] → Point (없으면 null)
function toPoint(p: number[] | undefined): Point | null {
    return p && p.length >= 2 ? { x: p[0], y: p[1] } : null;
}

// 경로 앞뒤에 붙일 도보 시간 (붙일 필요 없으면 0)
export function accessWalkTimes(route: KakaoRoute, start: Point, end: Point): { before: Seconds; after: Seconds } {
    const firstStop = toPoint(route.steps[0]?.path.points[0]);
    const lastStop = toPoint(route.steps.at(-1)?.path.points.at(-1));
    const straightBefore = firstStop ? distanceMeters(start, firstStop) : 0;
    const straightAfter = lastStop ? distanceMeters(lastStop, end) : 0;
    const straightSum = straightBefore + straightAfter;
    if (straightSum === 0) return { before: 0, after: 0 }; // 좌표 정보가 없으면 붙이지 않아요

    // 💡 사람은 직선으로 못 걸어요. 카카오가 잰 "빠진 거리"가 직선보다 길면 그만큼 늘려줘요
    const stepDistance = route.steps.reduce((sum, s) => sum + s.properties.distance, 0);
    const missing = route.properties.totalDistance - stepDistance;
    const detour = Math.min(MAX_DETOUR, Math.max(1, missing / straightSum));

    const toTime = (meters: number): Seconds => {
        const sec = Math.round((meters * detour) / WALK_SPEED);
        return sec < MIN_ACCESS_WALK ? 0 : sec;
    };
    return { before: toTime(straightBefore), after: toTime(straightAfter) };
}

// ─────────────────────────────────────────────────────────────
// 🚇 실시간 eta 꽂는 자리 (6단계) — 첫 차든 환승 차든 모든 차에 똑같이 물어봐요
// 변환은 계속 "순수 함수"로 두고, 실시간 데이터는 밖에서 함수로 받아요.
//   at.clock    = 보통 걸음으로 이 정류장에 닿는 시각
//   at.earliest = 빠른 걸음으로 닿을 수 있는 가장 이른 시각
// 조회 함수가 돌려주는 것
//   - 실시간 목록에 탈 수 있는 차가 있으면: earliest 기준 첫 차 (빨리 걸으면 탈 수 있는 앞차 포함)
//   - 목록은 맞는데 그 시각이 목록 범위 밖이면: clock 기준 배차 어림값 (estimated: true)
//   - 정류장·노선을 못 맞췄거나 조회 실패면: null → placeholderEta
// vehicle: 버스처럼 후보가 여러 대일 때, 실제로 고른 차 이름 (없으면 vehicles[0])
// ─────────────────────────────────────────────────────────────
export type EtaPick = { eta: EpochSeconds; vehicle?: string; estimated?: boolean };
export type ArrivalAt = { clock: EpochSeconds; earliest: EpochSeconds };
export type EtaLookup = (step: KakaoStep, at: ArrivalAt) => EtaPick | null;

// 실시간으로 조회할 차 구간들을 "중요한 순서"로: 각 경로의 첫 차 먼저, 그다음 환승 차
// 💡 조회 상한에 걸려 잘릴 때 첫 차가 살아남게 하려고 순서를 정해 둬요
export function ridesByPriority(res: KakaoResponse): KakaoStep[] {
    if (res.status !== "OK") return [];
    const rides = res.routes.map((r) => r.steps.filter((s) => s.properties.type !== "WALKING"));
    const first = rides.flatMap((r) => r.slice(0, 1));
    const transfers = rides.flatMap((r) => r.slice(1));
    return [...first, ...transfers];
}

// 배차 간격으로 어림한 eta: 보통 걸음으로 도착한 뒤 평균 "배차/2"를 기다린다고 봐요
// 💡 탑승 여유(1분)보다 짧게 잡으면 엔진이 "차를 놓쳤다"고 판단하니까 최소 1분은 둬요.
//    그러면 보통 걸음으로 딱 맞게 되어, 어림값에는 "빨리 걸으세요"가 뜨지 않아요 (틀릴 수 있어서 보수적으로)
export function estimatedEta(clock: EpochSeconds, headway: Seconds): EpochSeconds {
    return clock + Math.max(BOARDING_BUFFER, Math.round(headway / 2));
}

// step 하나를 core engine 구간 하나로 변환
//   clock:    보통 걸음으로 이 step을 시작하는 시각
//   earliest: 빠른 걸음으로 이 step을 시작할 수 있는 가장 이른 시각
function toSegment(step : KakaoStep, clock:EpochSeconds, earliest: EpochSeconds, etaFor?: EtaLookup): RouteSegment | null{
    const p = step.properties;

    switch(p.type){
        case "WALKING" : return {type : "walk", time : p.time};
        case "BUS":
        case "SUBWAY":{
            // vehicles는 리스트로 와도 하나만 탄다. 실시간이 고른 차가 있으면 그 차, 없으면 첫 번째
            const first = p.vehicles?.[0];
            if(!first) return null; // 탈 차 정보가 없으면 판정 x

            // 💡 실시간 → 없으면 placeholder 순서
            const pick = etaFor?.(step, { clock, earliest }) ?? null;
            const eta = pick?.eta ?? placeholderEta(clock);
            const name = pick?.vehicle ?? first.name;
            return p.type === "BUS"
            ? {type : "bus", time: p.time, busNumber: name, eta}
            : { type: "subway", time: p.time, lineNumber: name, eta };

        }
        default: return null // 카카오가 세 교통 수단 외에 다른 type을 가져다 두어도 터지지 않음
    }
}

// 카카오 경로 1개 -> TotalRoute로 변환
// ends(출발지·목적지)를 주면 처음·마지막 도보를 앞뒤에 붙여요
export function kakaoRouteToTotalRoute(
    route: KakaoRoute,
    now: EpochSeconds,
    ends?: { start: Point; end: Point },
    etaFor?: EtaLookup,
): TotalRoute | null {
    if (route.steps.length === 0) return null; // 빈 경로는 의미가 없음

    const segments : TotalRoute = [];
    let clock = now; // 엔진처럼 시계를 앞으로 굴리며 각 차의 eta를 구한다.
    // 💡 시계를 하나 더 굴려요: "빨리 걸으면 언제 닿나". 이걸로 고른 차가 엔진의 "빨리 걸으세요"를 만들어요
    let fastClock = now;
    const push = (seg: RouteSegment) => {
        if (seg.type === "walk") {
            clock += seg.time;
            fastClock += fastLimit(seg.time);
        } else {
            clock = fastClock = seg.eta + seg.time; // 차를 타면 두 시계가 같아져요
        }
        segments.push(seg);
    };

    const walks = ends ? accessWalkTimes(route, ends.start, ends.end) : { before: 0, after: 0 };

    // 💡 처음 도보를 먼저 넣어야 시계가 그만큼 가서, 첫 차의 eta도 늦춰져요
    if (walks.before > 0) push({ type: "walk", time: walks.before });

    for (const step of route.steps){
        const seg = toSegment(step, clock, fastClock, etaFor);
        if(seg === null) return null;
        push(seg);
    }

    if (walks.after > 0) push({ type: "walk", time: walks.after });
    return segments;
}

// 응답 전체 -> 엔진에 넣을 TotalRoute 목록
export function kakaoToTotalRoutes(
    res: KakaoResponse,
    now: EpochSeconds,
    ends?: { start: Point; end: Point },
    etaFor?: EtaLookup,
): TotalRoute[] {
    if(res.status!=="OK") return [];
    const result : TotalRoute[] = [];

    for(const route of res.routes){
        const total = kakaoRouteToTotalRoute(route, now, ends, etaFor);
        if(total !== null) result.push(total);
    }
    return result;
}
