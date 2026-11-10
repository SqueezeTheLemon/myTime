// 서울 지하철 실시간 도착 API를 부르고, 실패 이유를 분류한다. (서버에서만 사용)
// 💡 카카오 client(lib/kakao/transit_client.ts)와 같은 모양이에요. 차이는 두 가지:
//   1) 키가 헤더가 아니라 URL 경로 안에 들어가요
//   2) 에러여도 HTTP 200이 올 수 있어서, JSON 안의 code까지 봐야 해요
import { SubwayArrivalRow, SubwayResponse } from "./subway_types";

const SUBWAY_URL = "http://swopenapi.seoul.go.kr/api/subway";
const TIMEOUT_MS = 3000; // 실시간은 "있으면 좋은" 정보라 카카오보다 짧게 기다려요
const MAX_ROWS = 40; // 큰 환승역(서울역)도 23줄 정도라 넉넉해요

export type SubwayFetchResult =
    | { ok: true; rows: SubwayArrivalRow[] } // 열차 정보가 없으면 빈 목록 (실패 아님!)
    | { ok: false; reason: "no_key" | "auth" | "quota" | "upstream" };

export async function fetchSubwayArrivals(stationName: string): Promise<SubwayFetchResult> {
    const key = process.env.SEOUL_SUBWAY_API_KEY;
    if (!key) return { ok: false, reason: "no_key" };

    // 💡 한글 역 이름은 URL 경로에 넣기 전에 인코딩해요
    const url = `${SUBWAY_URL}/${key}/json/realtimeStationArrival/0/${MAX_ROWS}/${encodeURIComponent(stationName)}`;

    let res: Response;
    try {
        res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch {
        return { ok: false, reason: "upstream" };
    }
    if (res.status === 429) return { ok: false, reason: "quota" };
    if (!res.ok) return { ok: false, reason: "upstream" };

    let data: SubwayResponse;
    try {
        data = (await res.json()) as SubwayResponse;
    } catch {
        return { ok: false, reason: "upstream" }; // JSON이 아니면 (점검 페이지 등)
    }

    // 성공 모양이면 errorMessage.code, 실패 모양이면 바깥 code
    const code = "errorMessage" in data ? data.errorMessage.code : data.code;
    if (code === "INFO-000") return { ok: true, rows: data.realtimeArrivalList ?? [] };
    if (code === "INFO-200") return { ok: true, rows: [] }; // 그 역에 지금 열차 정보 없음
    if (code === "INFO-100") return { ok: false, reason: "auth" };
    // ⚠️ 한도 초과 코드는 아직 실측 못 했어요. 공식 문서 기준 ERROR-337(일일 트래픽 초과)로 가정
    if (code === "ERROR-337") return { ok: false, reason: "quota" };
    return { ok: false, reason: "upstream" };
}
