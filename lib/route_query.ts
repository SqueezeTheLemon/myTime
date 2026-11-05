// 주소창의 값을 검사하고 -> 숫자로 바꾼다. 

import { EpochSeconds } from "./core_engine";

export interface Point {
    x: number; // 경도 (longitude)
    y: number; // 위도 (latitude)
}

export interface RouteQuery {
    start: Point;
    end: Point;
    deadline: EpochSeconds;
}

export type ParseResult =
    | { ok: true; query: RouteQuery }
    | { ok: false; message: string };

// 서울 근처만 입력을 받는다. 
const SEOUL = { minX: 126.7, maxX: 127.3, minY: 37.4, maxY: 37.75 };

function inSeoul(p: Point): boolean {
    return p.x >= SEOUL.minX && p.x <= SEOUL.maxX && p.y >= SEOUL.minY && p.y <= SEOUL.maxY;
}

function toNumber(value: string | null): number | null {
    if (value === null || value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function parseRouteQuery(params: URLSearchParams, now: EpochSeconds): ParseResult {
    const sx = toNumber(params.get("sx"));
    const sy = toNumber(params.get("sy"));
    const ex = toNumber(params.get("ex"));
    const ey = toNumber(params.get("ey"));
    const deadline = toNumber(params.get("deadline"));

    if (sx === null || sy === null || ex === null || ey === null || deadline === null) {
        return { ok: false, message: "sx, sy, ex, ey, deadline은 모두 숫자로 보내야 해요" };
    }

    const start = { x: sx, y: sy };
    const end = { x: ex, y: ey };
    if (!inSeoul(start) || !inSeoul(end)) {
        return { ok: false, message: "출발지와 도착지는 서울 안이어야 해요" };
    }

    if (deadline <= now) {
        return { ok: false, message: "도착 마감 시각이 이미 지났어요" };
    }

    return { ok: true, query: { start, end, deadline } };
}