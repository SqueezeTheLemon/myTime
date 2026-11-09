
// 카카오 대중교통 API를 실제로 부르고, 실패 이유를 분류한다. (서버에서만 사용)
import { KakaoResponse } from "./transit_types";
import { Point } from "../routes/route_query";

const KAKAO_URL = "https://dapi.kakao.com/v2/routing/publictraffic";
const TIMEOUT_MS = 5000; // 카카오가 5초 안에 답이 없으면 포기

export type KakaoFetchResult =
    | { ok: true; data: KakaoResponse }
    | { ok: false; reason: "no_key" | "auth" | "quota" | "upstream" };

export async function fetchKakaoTransit(start: Point, end: Point): Promise<KakaoFetchResult> {
    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) return { ok: false, reason: "no_key" };

    const params = new URLSearchParams({
        start_x: String(start.x),
        start_y: String(start.y),
        end_x: String(end.x),
        end_y: String(end.y),
    });

    let res: Response; // 입력값 카카오에 전달 
    try {
        res = await fetch(`${KAKAO_URL}?${params}`, {
            headers: { Authorization: `KakaoAK ${key}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        return { ok: false, reason: "upstream" }; // 네트워크가 끊기거나 시간 초과
    }

    // HTTP 상태로 먼저 거르기 (키 문제, 한도 초과 …)
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "auth" };
    if (res.status === 429) return { ok: false, reason: "quota" }; //한도초과 
    if (!res.ok) return { ok: false, reason: "upstream" };

    return { ok: true, data: (await res.json()) as KakaoResponse };
}