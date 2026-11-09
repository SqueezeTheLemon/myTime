// 🧭 4. 이동 중 안내 화면에서 쓰는 순수 함수들이에요.
// 💡 화면(컴포넌트)은 "몇 번째 단계인지"와 "지금 시각"만 넘기고, 문구는 전부 여기서 만들어요. 그래서 테스트하기 쉬워요.
import { boardingDeadline, EpochSeconds, RouteOption, RouteSegment, Seconds, TotalRoute } from "../engine/core_engine";
import { formatDuration, formatLimit, segmentName, shortClock } from "./format";

// ───────── 저장 데이터 (목록 → 안내 화면으로 넘기는 값) ─────────

export interface GuideSession {
    version: 1; // 💡 나중에 모양이 바뀌면 숫자를 올려서 옛날 값을 버릴 수 있게 해 둬요
    option: RouteOption; // 고른 경로
    deadline: EpochSeconds;
    destName: string;
    routesQuery: string; // "다른 경로 보기"로 목록에 돌아갈 때 쓰는 주소창 값
    step: number; // 지금 몇 번째 구간인지 (route.length면 안내 끝)
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isSegment(v: unknown): v is RouteSegment {
    if (typeof v !== "object" || v === null) return false;
    const s = v as Record<string, unknown>;
    if (!isNum(s.time)) return false;
    if (s.type === "walk") return true;
    if (s.type === "bus") return typeof s.busNumber === "string" && isNum(s.eta);
    if (s.type === "subway") return typeof s.lineNumber === "string" && isNum(s.eta);
    return false;
}

// sessionStorage 문자열 → GuideSession. 모양이 이상하면 null
// 💡 저장소 값은 사용자가 개발자 도구로 바꿀 수도 있으니까, 믿지 말고 한 번 검사해요.
export function parseGuideSession(raw: string | null): GuideSession | null {
    if (raw === null) return null;
    let v: unknown;
    try {
        v = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof v !== "object" || v === null) return null;
    const s = v as Record<string, unknown>;
    const option = s.option as Record<string, unknown> | undefined;
    if (s.version !== 1 || typeof option !== "object" || option === null) return null;
    if (!Array.isArray(option.route) || option.route.length === 0 || !option.route.every(isSegment)) return null;
    if (!isNum(option.arrivalAt) || !Array.isArray(option.speedUps)) return null;
    const evaluation = option.evaluation as Record<string, unknown> | undefined;
    if (typeof evaluation !== "object" || evaluation === null || !isNum(evaluation.allowTime)) return null;
    if (!["ahead", "tight", "delayed"].includes(evaluation.evaluate as string)) return null;
    if (!isNum(s.deadline) || typeof s.destName !== "string" || typeof s.routesQuery !== "string") return null;

    const step = isNum(s.step) ? Math.min(Math.max(0, Math.floor(s.step)), option.route.length) : 0;
    return { ...(s as unknown as GuideSession), step };
}

// ───────── 한국어 조사 ─────────

// "740번 버스" → "740번 버스를", "지하철 4호선" → "지하철 4호선을"
// 💡 한글 마지막 글자에 받침이 있으면 앞의 것(을), 없으면 뒤의 것(를)을 붙여요
export function withJosa(word: string, withBatchim: string, withoutBatchim: string): string {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    if (code < 0 || code > 11171) return `${word}${withBatchim}(${withoutBatchim})`; // 한글이 아니면 둘 다
    return word + (code % 28 === 0 ? withoutBatchim : withBatchim);
}

// ───────── 단계 정보 ─────────

// 이 도보로 가는 곳: 다음이 버스면 "정류장", 지하철이면 "역", 마지막 도보면 도착지 이름
export function walkPlace(route: TotalRoute, i: number, destName: string): string {
    const next = route[i + 1];
    if (next === undefined) return destName;
    if (next.type === "bus") return "정류장";
    if (next.type === "subway") return "역";
    return "다음 구간";
}

// 이 도보를 끝내야 하는 시각. 엔진과 같은 기준이에요 (다음 차 도착 1분 전 / 마지막이면 데드라인)
export function walkTarget(route: TotalRoute, i: number, deadline: EpochSeconds): EpochSeconds | null {
    const next = route[i + 1];
    if (next === undefined) return deadline;
    if (next.type === "walk") return null;
    return boardingDeadline(next.eta);
}

// 단계 목록 한 줄 이름: "도보 2분 · 정류장까지", "740번 버스 11분"
export function stepLabel(route: TotalRoute, i: number, destName: string): string {
    const seg = route[i];
    if (seg.type === "walk") return `도보 ${formatDuration(seg.time)} · ${walkPlace(route, i, destName)}까지`;
    return `${segmentName(seg)} ${formatDuration(seg.time)}`;
}

// 지도 위 카드 제목: "정류장까지 걷기", "740번 버스 타기"
export function stepHeadline(route: TotalRoute, i: number, destName: string): string {
    const seg = route[i];
    if (seg.type === "walk") return `${walkPlace(route, i, destName)}까지 걷기`;
    return `${segmentName(seg)} 타기`;
}

// 아직 안 한 단계 오른쪽에 붙는 시각: "2:16 탑승", 마지막은 "2:29 도착"
export function pendingTime(option: RouteOption, i: number): string {
    const seg = option.route[i];
    if (seg.type !== "walk") return `${shortClock(seg.eta)} 탑승`;
    if (i === option.route.length - 1) return `${shortClock(option.arrivalAt)} 도착`;
    return "";
}

export interface StepGuide {
    instruction: string; // 큰 글씨 "지금 해야 할 일"
    detail: string; // 그 아래 설명
}

// "지금 해야 할 일" 카드 문구
// 💡 now가 null(서버에서 그릴 때)이면 경로를 계산할 때 정해 둔 시간으로 대신 보여줘요.
export function stepGuide(option: RouteOption, i: number, deadline: EpochSeconds, destName: string, now: EpochSeconds | null): StepGuide {
    const { route } = option;
    const seg = route[i];
    const next = route[i + 1];

    if (seg.type !== "walk") {
        const name = segmentName(seg);
        const vehicle = seg.type === "bus" ? "버스" : "열차";
        const after = next?.type === "walk" ? ` 내린 뒤 도보 ${formatDuration(next.time)}이에요.` : "";
        return {
            instruction: `${withJosa(name, "을", "를")} 타세요`,
            detail: `${shortClock(seg.eta)}쯤 오는 ${vehicle}예요. ${formatDuration(seg.time)} 동안 타고 가요.${after}`,
        };
    }

    const place = walkPlace(route, i, destName);
    const target = walkTarget(route, i, deadline);

    // 다음도 도보인 드문 경우: 마감이 없으니 걸리는 시간만 알려줘요
    if (target === null || next?.type === "walk") {
        return { instruction: `${place}까지 걸어가세요`, detail: `보통 걸음으로 ${formatDuration(seg.time)} 걸려요.` };
    }

    // 마지막 도보: 도착지까지 걷는 시간 + 데드라인
    if (next === undefined) {
        const left = now === null ? null : target - now;
        const hurry = left !== null && left < seg.time;
        return {
            instruction: `${place}까지 ${formatDuration(seg.time)} 걸어가세요`,
            detail: hurry
                ? `조금 빨리 걸어야 ${shortClock(deadline)}까지 도착해요.`
                : `${shortClock(deadline)}까지 도착하면 돼요.`,
        };
    }

    // 차를 타러 가는 도보: 탑승 1분 전까지 남은 시간
    const speedUp = option.speedUps.find((s) => s.segmentIndex === i);
    const left: Seconds = now === null ? (speedUp?.timeLimit ?? seg.time) : target - now;
    const vehicleName = segmentName(next);

    if (left <= 0) {
        return {
            instruction: `서둘러 ${place}에 가세요`,
            detail: `${vehicleName} 탑승 시각이 지났어요. 놓쳤다면 '문제가 생겼어요'를 눌러 주세요.`,
        };
    }
    const fast = left < seg.time ? " 보통 걸음보다 조금 빨리 걸어야 해요." : "";
    return {
        instruction: `${formatLimit(left)} 안에 ${place}에 도착하세요`,
        detail: `${vehicleName} 도착 예정 ${shortClock(next.eta)} · 1분 여유를 두고 계산했어요.${fast}`,
    };
}

// 남은 시간 타일: 1050초 → "17분", 이미 지났으면 "0분"
export function remainingMinutes(sec: Seconds): string {
    return `${Math.max(0, Math.floor(sec / 60))}분`;
}
