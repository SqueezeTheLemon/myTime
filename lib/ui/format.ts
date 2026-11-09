// 🖍️ 엔진 결과(초 단위 숫자)를 화면 문구로 바꾸는 순수 함수들이에요.
// 💡 엔진 주석의 약속대로 Date는 여기 "출구"에서만 써요.
import { EpochSeconds, EvaluateResult, RouteSegment, Seconds } from "../engine/core_engine";

// 1700000000 → "오후 2:30"
export function formatClock(epoch: EpochSeconds): string {
    const d = new Date(epoch * 1000);
    const period = d.getHours() < 12 ? "오전" : "오후";
    return `${period} ${shortClock(epoch)}`;
}

// 1700000000 → "2:29" (카드 안 "2:29 도착"처럼 오전/오후 없이)
export function shortClock(epoch: EpochSeconds): string {
    const d = new Date(epoch * 1000);
    const h12 = d.getHours() % 12 || 12;
    return `${h12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 이동 시간: 반올림한 분 (최소 1분). 180 → "3분", 3900 → "1시간 5분"
export function formatDuration(sec: Seconds): string {
    const total = Math.max(1, Math.round(sec / 60));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}분`;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// 빨리 걸어야 하는 "제한 시간": 30초 단위로 내림해요.
// 💡 올리면 실제로 주어진 시간보다 길게 안내하게 돼서 차를 놓칠 수 있어요.
export function formatLimit(sec: Seconds): string {
    const halfMinutes = Math.floor(sec / 30);
    const m = Math.floor(halfMinutes / 2);
    const withHalf = halfMinutes % 2 === 1;
    if (m === 0) return "30초";
    return withHalf ? `${m}분 30초` : `${m}분`;
}

// 데드라인까지 남은 시간: "18분 남음"
export function formatRemaining(sec: Seconds): string {
    if (sec <= 0) return "마감 시각이 지났어요";
    const m = Math.floor(sec / 60);
    if (m === 0) return "1분 안 남음";
    return `${formatDuration(m * 60)} 남음`;
}

// 카드 오른쪽 위: "여유 3분" / "여유 1분 미만" / "2분 늦음"
export function formatAllowance(evaluation: EvaluateResult): string {
    const { evaluate, allowTime } = evaluation;
    if (evaluate === "ahead") return `여유 ${Math.floor(allowTime / 60)}분`;
    if (evaluate === "tight") return "여유 1분 미만";
    return `${Math.max(1, Math.ceil(-allowTime / 60))}분 늦음`;
}

export const EVALUATION_BADGE: Record<EvaluateResult["evaluate"], string> = {
    ahead: "정시 도착 가능",
    tight: "빠듯해요",
    delayed: "조금 늦어요",
};

// 구간 칩 이름 (시간 제외): "도보", "740번 버스", "지하철 4호선"
export function segmentName(seg: RouteSegment): string {
    switch (seg.type) {
        case "walk":
            return "도보";
        case "bus":
            return `${seg.busNumber}번 버스`;
        case "subway":
            // 카카오가 "4호선"처럼 주면 앞에 "지하철"을 붙이고, "신분당선"처럼 이름이 있으면 그대로 써요.
            return /^\d+호선$/.test(seg.lineNumber) ? `지하철 ${seg.lineNumber}` : seg.lineNumber;
    }
}
