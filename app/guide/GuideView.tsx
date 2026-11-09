"use client";
// 🚶 이동 중 안내: 저장된 경로를 읽어서 "지금 해야 할 일" + 단계 목록을 보여줘요.
// 한 화면 컴포넌트가 단계(step)만 바꿔 가며 목업의 Guide / Guide-Bus / Guide-Walk를 모두 그려요.
import { useState } from "react";
import Link from "next/link";
import type { EpochSeconds } from "../../lib/engine/core_engine";
import { formatClock, shortClock } from "../../lib/ui/format";
import { GuideSession, pendingTime, remainingMinutes, stepGuide, stepLabel } from "../../lib/ui/guide";
import { useNow } from "../_components/use_now";
import { setGuideStep, useGuideSession } from "./guide_store";
import AllowanceBadge from "./AllowanceBadge";
import GuideMap from "./GuideMap";
import ProblemSheet from "./ProblemSheet";

export default function GuideView() {
    const session = useGuideSession();
    const now = useNow();
    const [view, setView] = useState<"steps" | "map">("steps");
    const [problemOpen, setProblemOpen] = useState(false);

    if (session === undefined) return null; // 저장소를 읽기 전 (아주 잠깐)
    if (session === null) return <NoRoute />;
    if (session.step >= session.option.route.length) return <Finished session={session} />;

    const next = () => setGuideStep(session, session.step + 1);
    const actions = { onNext: next, onProblem: () => setProblemOpen(true) };

    return (
        <>
            {view === "map" ? (
                <GuideMap session={session} now={now} onShowSteps={() => setView("steps")} {...actions} />
            ) : (
                <StepsScreen session={session} now={now} onShowMap={() => setView("map")} {...actions} />
            )}
            {problemOpen && (
                <ProblemSheet label={stepLabel(session.option.route, session.step, session.destName)} onClose={() => setProblemOpen(false)} />
            )}
        </>
    );
}

interface ScreenProps {
    session: GuideSession;
    now: EpochSeconds | null;
    onNext: () => void;
    onProblem: () => void;
}

function StepsScreen({ session, now, onNext, onProblem, onShowMap }: ScreenProps & { onShowMap: () => void }) {
    const { option, deadline, destName, step, routesQuery } = session;
    const guide = stepGuide(option, step, deadline, destName, now);
    const isLast = step === option.route.length - 1;

    return (
        <div className="flex flex-1 flex-col gap-3.5 px-4 pt-6 pb-5">
            {/* 윗줄: 도착지 · 지금 시각 / 지도 · 여유 배지 */}
            <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm text-on-ink-muted">
                    {destName}
                    {now !== null && ` · ${formatClock(now)}`}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={onShowMap}
                        className="min-h-8 rounded-full border border-on-ink-outline px-3 text-xs font-bold text-white"
                    >
                        지도
                    </button>
                    <AllowanceBadge session={session} />
                </div>
            </div>

            {/* 시간 타일 3개 */}
            <div className="flex gap-2.5">
                <TimeTile label="남은 시간" value={now === null ? "-" : remainingMinutes(deadline - now)} />
                <TimeTile label="목표 도착" value={shortClock(deadline)} />
                <TimeTile label="예상 도착" value={shortClock(option.arrivalAt)} highlight />
            </div>

            {/* 지금 해야 할 일 */}
            <section className="flex flex-col gap-2.5 rounded-sheet bg-card px-5 py-[22px] text-ink" aria-live="polite">
                <h2 className="text-[13px] font-bold text-brand">지금 해야 할 일</h2>
                <p className="text-[28px] leading-[1.3] font-black break-keep">{guide.instruction}</p>
                <p className="text-sm leading-normal text-muted">{guide.detail}</p>
            </section>

            {/* 단계 목록 */}
            <ol className="flex flex-col gap-3.5 rounded-[18px] bg-ink-raised px-[18px] py-4">
                {option.route.map((_, i) => {
                    const status = i < step ? "done" : i === step ? "current" : "pending";
                    return (
                        <li key={i} className="flex items-center gap-3" aria-current={status === "current" ? "step" : undefined}>
                            <StepDot status={status} />
                            <span className={`flex-1 text-[15px] ${status === "current" ? "font-bold" : "text-on-ink-muted"}`}>
                                {stepLabel(option.route, i, destName)}
                            </span>
                            <span className={`shrink-0 text-[13px] ${status === "current" ? "font-bold text-accent" : "text-on-ink-muted"}`}>
                                {status === "done" ? "완료" : status === "current" ? "진행 중" : pendingTime(option, i)}
                            </span>
                        </li>
                    );
                })}
            </ol>

            {/* 아래 버튼들 */}
            <div className="mt-auto flex flex-col gap-2.5 pt-2">
                <button type="button" onClick={onNext} className="min-h-[54px] w-full rounded-card bg-brand text-base font-bold text-white">
                    {isLast ? "완료했어요, 안내 끝내기" : "완료했어요, 다음 단계로"}
                </button>
                <div className="flex gap-2.5">
                    <Link
                        href={`/routes?${routesQuery}`}
                        className="flex min-h-[52px] flex-1 items-center justify-center rounded-option border border-on-ink-outline text-[15px] text-white"
                    >
                        다른 경로 보기
                    </Link>
                    <button type="button" onClick={onProblem} className="min-h-[52px] flex-1 rounded-option bg-accent text-[15px] font-bold text-ink">
                        문제가 생겼어요
                    </button>
                </div>
            </div>
        </div>
    );
}

function TimeTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-card bg-ink-raised px-3.5 py-3">
            <span className="text-xs text-on-ink-muted">{label}</span>
            <span className={`text-[30px] leading-tight font-black ${highlight ? "text-accent" : ""}`}>{value}</span>
        </div>
    );
}

// 단계 앞 동그라미: 완료 = 회색 체크, 진행 중 = 노란 점, 대기 = 빈 원
function StepDot({ status }: { status: "done" | "current" | "pending" }) {
    if (status === "done") {
        return (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="-ml-px shrink-0">
                <circle cx="7" cy="7" r="7" className="fill-on-ink-outline" />
                <path d="M4 7.2l2 2 4-4.4" className="stroke-ink" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (status === "current") return <span className="size-3 shrink-0 rounded-full bg-accent" aria-hidden="true" />;
    return <span className="size-3 shrink-0 rounded-full border-2 border-on-ink-outline" aria-hidden="true" />;
}

// 저장된 경로가 없을 때 (주소로 바로 들어왔거나, 탭을 새로 열었을 때)
function NoRoute() {
    return (
        <div className="flex flex-1 flex-col justify-center gap-4 px-4">
            <p className="text-[22px] font-bold">안내할 경로가 없어요</p>
            <p className="text-[15px] text-on-ink-muted">처음 화면에서 목적지와 도착 시각을 정하고 경로를 골라 주세요.</p>
            <Link href="/" className="flex min-h-[54px] items-center justify-center rounded-card bg-brand text-base font-bold text-white">
                처음으로
            </Link>
        </div>
    );
}

// 마지막 단계까지 완료했을 때 — 임시 화면이에요. 5단계 "도착" 화면(목업 Arrived)으로 바꿀 자리
function Finished({ session }: { session: GuideSession }) {
    return (
        <div className="flex flex-1 flex-col justify-center gap-4 px-4">
            <p className="text-[28px] leading-[1.3] font-black">{session.destName}에 도착했어요 🎉</p>
            <p className="text-[15px] text-on-ink-muted">목표 도착 시각은 {formatClock(session.deadline)}이었어요.</p>
            <div className="flex flex-col gap-2.5">
                <Link href="/" className="flex min-h-[54px] items-center justify-center rounded-card bg-brand text-base font-bold text-white">
                    처음으로
                </Link>
                <button
                    type="button"
                    onClick={() => setGuideStep(session, session.option.route.length - 1)}
                    className="min-h-[52px] rounded-option border border-on-ink-outline text-[15px] text-white"
                >
                    마지막 단계로 돌아가기
                </button>
            </div>
        </div>
    );
}
