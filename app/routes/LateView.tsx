"use client";
// ⏰ 제시간 도착 불가 (목업 Late). 경로 목록 대신 이 화면을 보여줘요.
import { useState } from "react";
import Link from "next/link";
import type { EpochSeconds, Seconds } from "../../lib/engine/core_engine";
import { formatClock } from "../../lib/ui/format";
import { lateMessage, lateMinutes } from "../../lib/ui/result";

interface Props {
    fastestArrivalAt: EpochSeconds | null;
    lateBy: Seconds | null;
}

export default function LateView({ fastestArrivalAt, lateBy }: Props) {
    const known = fastestArrivalAt !== null && lateBy !== null;
    const [text, setText] = useState(() => (known ? lateMessage(fastestArrivalAt, lateBy) : ""));
    const [copy, setCopy] = useState<"idle" | "done" | "fail">("idle");

    const copyText = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopy("done");
        } catch {
            setCopy("fail"); // http 주소나 권한 문제로 막힐 수 있어요
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-3.5 px-4 pt-6 pb-5">
            <span className="self-start rounded-full bg-late px-3 py-1 text-xs font-bold text-white">제시간 도착 불가</span>
            <h1 className="text-[30px] leading-[1.3] font-black">
                제시간 도착이
                <br />
                어려워요
            </h1>
            <p className="text-base leading-normal text-muted">
                {known
                    ? `가장 빠른 경로로 가도 ${formatClock(fastestArrivalAt)}에 도착해요. 목표보다 ${lateMinutes(lateBy)}분 늦어요.`
                    : "지금 탈 수 있는 경로를 찾지 못했어요."}
            </p>

            {/* 늦는다고 미리 알리기: 문구를 고친 뒤 복사해서 메신저에 붙여 넣어요 */}
            {known && (
                <section className="flex flex-col gap-2.5 rounded-[18px] bg-card px-[18px] py-4">
                    <label htmlFor="late-message" className="text-[13px] font-bold text-brand">
                        늦는다고 미리 알리기
                    </label>
                    <textarea
                        id="late-message"
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            setCopy("idle");
                        }}
                        rows={3}
                        className="resize-none rounded-tile bg-surface px-3.5 py-3 text-base leading-relaxed outline-brand"
                    />
                    <p className="text-xs text-muted">문구는 복사하기 전에 바꿀 수 있어요.</p>
                </section>
            )}

            <div className="mt-auto flex flex-col gap-2.5">
                {copy === "fail" && (
                    <p className="text-sm text-warn-ink" role="alert">
                        복사하지 못했어요. 글자를 길게 눌러 직접 복사해 주세요.
                    </p>
                )}
                {known && (
                    <button type="button" onClick={copyText} className="min-h-[54px] w-full rounded-card bg-brand text-base font-bold text-white">
                        {copy === "done" ? "복사했어요 ✓" : "메시지 복사하기"}
                    </button>
                )}
                {/* 💡 "가장 빠른 경로로 계속 안내"는 서버가 그 경로를 같이 줘야 해서, 백엔드 작업 뒤에 붙여요 */}
                <Link
                    href="/"
                    className="flex min-h-[50px] items-center justify-center rounded-card border border-border bg-card text-[15px] font-medium text-ink"
                >
                    데드라인 다시 정하기
                </Link>
            </div>
        </div>
    );
}
