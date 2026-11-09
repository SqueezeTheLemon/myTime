"use client";
// 🎉 도착 완료 (목업 Arrived). "안내 끝내기"를 누른 시각을 도착 시각으로 봐요.
import Link from "next/link";
import { shortClock } from "../../lib/ui/format";
import type { GuideSession } from "../../lib/ui/guide";
import { arrivalResult, routeSummary, totalTravel } from "../../lib/ui/result";
import { setGuideStep } from "./guide_store";

export default function Arrived({ session }: { session: GuideSession }) {
    const { option, deadline, startedAt } = session;
    // 💡 옛날에 저장된 값엔 arrivedAt이 없을 수 있어서, 그땐 경로의 예상 도착으로 대신해요
    const arrivedAt = session.arrivedAt ?? option.arrivalAt;
    const result = arrivalResult(arrivedAt, deadline);

    return (
        // 어두운 안내 화면 위에 밝은 결과 화면을 덮어요
        <div className="flex flex-1 flex-col gap-3.5 bg-surface px-4 pt-6 pb-5 text-ink">
            <div className="flex flex-col items-center gap-3 pt-6">
                <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                    <circle cx="36" cy="36" r="34" className={result.onTime ? "fill-brand" : "fill-late"} />
                    <path d="M22 37l10 10 18-20" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h1 className="text-[28px] font-black">{result.title}</h1>
            </div>

            <div className="flex gap-2.5">
                <Tile label="도착" value={shortClock(arrivedAt)} />
                <Tile label="목표" value={shortClock(deadline)} />
                <Tile label={result.diffLabel} value={result.diffValue} accent={result.onTime ? "text-brand" : "text-late"} />
            </div>

            <section className="flex flex-col gap-2 rounded-card bg-card px-4 py-3.5 text-sm">
                <h2 className="font-bold">이동 요약 · 총 {totalTravel(option.route, startedAt, session.arrivedAt)}</h2>
                <p className="text-muted">{routeSummary(option.route)}</p>
            </section>

            <div className="mt-auto flex flex-col gap-2.5">
                <Link href="/" className="flex min-h-[54px] items-center justify-center rounded-card bg-brand text-base font-bold text-white">
                    완료
                </Link>
                {/* 실수로 "안내 끝내기"를 눌렀을 때 돌아갈 길 */}
                <button
                    type="button"
                    onClick={() => setGuideStep(session, option.route.length - 1)}
                    className="min-h-11 text-sm text-muted underline underline-offset-2"
                >
                    아직 도착 전이에요, 안내로 돌아가기
                </button>
            </div>
        </div>
    );
}

function Tile({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-card bg-card px-3.5 py-3">
            <span className="text-xs text-muted">{label}</span>
            <span className={`text-[28px] leading-tight font-black ${accent}`}>{value}</span>
        </div>
    );
}
