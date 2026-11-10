// 서울 버스 도착정보 API를 부르고, 실패 이유를 분류한다. (서버에서만 사용)
// 💡 지하철 client(lib/subway/subway_client.ts)와 같은 모양이에요
import { BusArrivalRow, BusResponse } from "./bus_types";

const BUS_URL = "http://ws.bus.go.kr/api/rest/arrive/getArrInfoByRouteAll"; // https는 응답이 없어서 http
const TIMEOUT_MS = 3000;

export type BusFetchResult =
    | { ok: true; rows: BusArrivalRow[] }
    | { ok: false; reason: "no_key" | "auth" | "quota" | "upstream" };

export async function fetchBusArrivals(busRouteId: string): Promise<BusFetchResult> {
    const key = process.env.DATA_GO_KR_API_KEY;
    if (!key) return { ok: false, reason: "no_key" };

    const params = new URLSearchParams({ serviceKey: key, busRouteId, resultType: "json" });
    let res: Response;
    try {
        res = await fetch(`${BUS_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch {
        return { ok: false, reason: "upstream" };
    }
    // 신청 안 한 서비스·틀린 키는 401 "등록되지 않은 서비스키" (실측)
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "auth" };
    if (res.status === 429) return { ok: false, reason: "quota" };
    if (!res.ok) return { ok: false, reason: "upstream" };

    let data: BusResponse;
    try {
        data = (await res.json()) as BusResponse;
    } catch {
        return { ok: false, reason: "upstream" };
    }
    if (data.msgHeader?.headerCd !== "0") return { ok: false, reason: "upstream" };
    return { ok: true, rows: data.msgBody.itemList ?? [] };
}
