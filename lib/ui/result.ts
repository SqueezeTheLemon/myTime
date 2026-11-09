// 🏁 5단계(다시 계산 · 도착 불가 · 도착) 화면 문구를 만드는 순수 함수들이에요.
import type { EpochSeconds, Seconds, TotalRoute } from "../engine/core_engine";
import { formatClock, formatDuration, segmentName, shortClock } from "./format";

// ───────── 다시 계산 ─────────

// 문제 시트에서 고르는 이유. 값(key)은 주소창에 들어가고, 문구는 화면에 보여줘요.
export const RECALC_REASONS = {
    "missed-bus": { label: "버스를 놓쳤어요", because: "버스를 놓쳐서" },
    "missed-subway": { label: "지하철을 놓쳤어요", because: "지하철을 놓쳐서" },
    "wrong-way": { label: "길을 잘못 들었어요", because: "길을 잘못 들어서" },
    delay: { label: "차가 막혀요 / 지하철이 연착돼요", because: "차가 막히거나 연착돼서" },
} as const;
export type RecalcReason = keyof typeof RECALC_REASONS;

const isReason = (v: string | null): v is RecalcReason => v !== null && v in RECALC_REASONS;

// 원래 목록 주소에서 출발지만 "지금 위치"로 바꾸고, 다시 계산한 이유와 시각을 붙여요.
// 💡 도착지·데드라인·도착지 이름은 그대로라서, 원래 목록 주소(routesQuery)를 재활용하면 돼요.
export function recalcQuery(routesQuery: string, from: { x: number; y: number }, reason: RecalcReason | null, at: EpochSeconds): string {
    const params = new URLSearchParams(routesQuery);
    params.set("sx", String(from.x));
    params.set("sy", String(from.y));
    if (reason) params.set("reason", reason);
    else params.delete("reason");
    params.set("at", String(at));
    return params.toString();
}

// 목록 화면 위 안내 띠: "버스를 놓쳐서 2:16에 다시 계산했어요". 다시 계산한 게 아니면 null
export function recalcBanner(reason: string | null, at: string | null): string | null {
    const when = Number(at);
    if (!at || !Number.isFinite(when) || when <= 0) return null;
    const because = isReason(reason) ? `${RECALC_REASONS[reason].because} ` : "";
    return `${because}${shortClock(when)}에 다시 계산했어요`;
}

// ───────── 제시간 도착 불가 ─────────

// 늦는다고 알리는 메시지 초안: "6분 정도 늦을 것 같아요. 오후 2:36쯤 도착해요. 죄송합니다."
export function lateMessage(fastestArrivalAt: EpochSeconds, lateBy: Seconds): string {
    return `${lateMinutes(lateBy)}분 정도 늦을 것 같아요. ${formatClock(fastestArrivalAt)}쯤 도착해요. 죄송합니다.`;
}

// 늦는 시간은 올림이에요. 30초 늦어도 "1분 늦음"이 맞아요.
export function lateMinutes(lateBy: Seconds): number {
    return Math.max(1, Math.ceil(lateBy / 60));
}

// ───────── 도착 ─────────

export interface ArrivalResult {
    onTime: boolean;
    title: string; // "제시간에 도착했어요" / "3분 늦게 도착했어요"
    diffLabel: string; // 세 번째 타일 이름: "여유" / "늦음"
    diffValue: string; // "2분"
}

export function arrivalResult(arrivedAt: EpochSeconds, deadline: EpochSeconds): ArrivalResult {
    const diff = deadline - arrivedAt;
    if (diff >= 0) {
        return { onTime: true, title: "제시간에 도착했어요", diffLabel: "여유", diffValue: `${Math.floor(diff / 60)}분` };
    }
    const late = lateMinutes(-diff);
    return { onTime: false, title: `${late}분 늦게 도착했어요`, diffLabel: "늦음", diffValue: `${late}분` };
}

// 이동 요약 줄: "도보 3분 → 740번 버스 11분 → 도보 4분"
export function routeSummary(route: TotalRoute): string {
    return route.map((seg) => `${segmentName(seg)} ${formatDuration(seg.time)}`).join(" → ");
}

// 총 이동 시간: 실제로 걸린 시간을 알면 그걸, 모르면 구간 시간을 더해요
export function totalTravel(route: TotalRoute, startedAt?: EpochSeconds, arrivedAt?: EpochSeconds): string {
    const sec = startedAt !== undefined && arrivedAt !== undefined && arrivedAt > startedAt
        ? arrivedAt - startedAt
        : route.reduce((sum, seg) => sum + seg.time, 0);
    return formatDuration(sec);
}
