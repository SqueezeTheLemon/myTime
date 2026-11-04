// 🚪 /api/routes 로 들어온 주소창 값(쿼리)을 검사하고 숫자로 바꿔요
// 💡 Request를 몰라도 되는 순수 함수라서 테스트하기 쉬워요
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

// 서울 근처만 받아요 (대충 넉넉하게 잡은 네모)
const SEOUL = { minX: 126.7, maxX: 127.3, minY: 37.4, maxY: 37.75 };

function inSeoul(p: Point): boolean {
    return p.x >= SEOUL.minX && p.x <= SEOUL.maxX && p.y >= SEOUL.minY && p.y <= SEOUL.maxY;
}

// 💡 Number("")는 0, Number(null)도 0이 돼서 위험해요. 빈 값은 먼저 걸러요
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