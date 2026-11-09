"use client";
// 🗺️ 3-1. 지도 보기 (목업 Map). 진짜 지도는 7단계에서 붙이고, 지금은 자리만 잡아 둬요.
import type { EpochSeconds } from "../../lib/engine/core_engine";
import { shortClock } from "../../lib/ui/format";
import { GuideSession, remainingMinutes, stepGuide, stepHeadline, stepLabel } from "../../lib/ui/guide";
import AllowanceBadge from "./AllowanceBadge";

interface Props {
    session: GuideSession;
    now: EpochSeconds | null;
    onNext: () => void;
    onProblem: () => void;
    onShowSteps: () => void;
}

export default function GuideMap({ session, now, onNext, onProblem, onShowSteps }: Props) {
    const { option, deadline, destName, step } = session;
    const guide = stepGuide(option, step, deadline, destName, now);
    const isLast = step === option.route.length - 1;

    return (
        <div className="flex flex-1 flex-col">
            {/* 윗줄: 남은 시간 + 여유 */}
            <div className="flex items-center justify-between px-[18px] pt-[22px] pb-3.5">
                <p className="flex items-baseline gap-2">
                    <span className="text-[28px] font-black">{now === null ? "-" : remainingMinutes(deadline - now)}</span>
                    <span className="text-[13px] text-on-ink-muted">남음 · {shortClock(deadline)} 도착 목표</span>
                </p>
                <AllowanceBadge session={session} />
            </div>

            {/* 지도 자리 */}
            <div className="relative min-h-[320px] flex-1 overflow-hidden bg-map-ground">
                <MapPlaceholder />
                <div className="absolute inset-x-3 top-3 flex items-center gap-3.5 rounded-card bg-card px-4 py-3 text-ink shadow-[0_2px_10px_rgba(18,32,47,0.18)]">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-tile bg-brand text-white" aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-xl font-black">
                            {step + 1}단계 · {stepHeadline(option.route, step, destName)}
                        </span>
                        <span className="text-[13px] text-muted">{stepLabel(option.route, step, destName)}</span>
                    </div>
                </div>
                <p className="absolute inset-x-0 bottom-8 text-center text-xs text-muted">지도는 준비 중이에요</p>
            </div>

            {/* 아래 시트 */}
            <div className="relative -mt-5 flex flex-col gap-3 rounded-t-sheet bg-card px-[18px] pt-[18px] pb-5 text-ink">
                <div className="flex items-baseline justify-between">
                    <h2 className="text-[13px] font-bold text-brand">지금 해야 할 일</h2>
                    <span className="text-[13px] text-muted">예상 도착 {shortClock(option.arrivalAt)}</span>
                </div>
                <p className="text-[22px] leading-[1.3] font-black break-keep" aria-live="polite">
                    {guide.instruction}
                </p>
                <button type="button" onClick={onNext} className="min-h-[54px] w-full rounded-card bg-brand text-base font-bold text-white">
                    {isLast ? "완료했어요, 안내 끝내기" : "완료했어요, 다음 단계로"}
                </button>
                <div className="flex gap-2.5">
                    <button
                        type="button"
                        onClick={onShowSteps}
                        className="min-h-12 flex-1 rounded-option border border-border bg-card text-sm font-medium text-ink"
                    >
                        단계 목록 보기
                    </button>
                    <button type="button" onClick={onProblem} className="min-h-12 flex-1 rounded-option bg-accent text-sm font-bold text-ink">
                        문제가 생겼어요
                    </button>
                </div>
            </div>
        </div>
    );
}

// 장식용 도로 그림 (실제 경로가 아니에요)
function MapPlaceholder() {
    return (
        <svg className="absolute inset-0 size-full" viewBox="0 0 390 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g className="stroke-map-road" fill="none">
                <path d="M-10 420 L400 400" strokeWidth="26" />
                <path d="M60 600 L90 -10" strokeWidth="18" />
                <path d="M300 600 L310 -10" strokeWidth="18" />
                <path d="M-10 250 L400 270" strokeWidth="16" />
            </g>
        </svg>
    );
}
