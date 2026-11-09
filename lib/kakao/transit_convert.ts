// 카카오 응답 -> 엔진이 이해할 수 있는 Total Route로 바꾸기
import { BOARDING_BUFFER, EpochSeconds, RouteSegment, Seconds, TotalRoute } from "../engine/core_engine";
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

// step 하나를 core engine 구간 하나로 변환
function toSegment(step : KakaoStep, clock:EpochSeconds): RouteSegment | null{
    const p = step.properties;

    switch(p.type){
        case "WALKING" : return {type : "walk", time : p.time};
        case "BUS":
        case "SUBWAY":{
            // vehicles는 우선 리스트로 와도 하나만 탄다.
            const first = p.vehicles?.[0];
            if(!first) return null; // 탈 차 정보가 없으면 판정 x

            const eta = placeholderEta(clock);
            return p.type === "BUS"
            ? {type : "bus", time: p.time, busNumber: first.name, eta}
            : { type: "subway", time: p.time, lineNumber: first.name, eta };

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
): TotalRoute | null {
    if (route.steps.length === 0) return null; // 빈 경로는 의미가 없음

    const segments : TotalRoute = [];
    let clock = now; // 엔진처럼 시계를 앞으로 굴리며 각 차의 eta를 구한다.
    const push = (seg: RouteSegment) => {
        clock = seg.type === "walk" ? clock + seg.time : seg.eta + seg.time;
        segments.push(seg);
    };

    const walks = ends ? accessWalkTimes(route, ends.start, ends.end) : { before: 0, after: 0 };

    // 💡 처음 도보를 먼저 넣어야 시계가 그만큼 가서, 첫 차의 eta도 늦춰져요
    if (walks.before > 0) push({ type: "walk", time: walks.before });

    for (const step of route.steps){
        const seg = toSegment(step, clock);
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
): TotalRoute[] {
    if(res.status!=="OK") return [];
    const result : TotalRoute[] = [];

    for(const route of res.routes){
        const total = kakaoRouteToTotalRoute(route, now, ends);
        if(total !== null) result.push(total);
    }
    return result;
}
