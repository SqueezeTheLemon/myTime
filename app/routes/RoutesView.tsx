"use client";
// 🧭 2. 경로 목록 화면. 주소창 값 → /api/routes 호출 → 카드 목록
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FinalResult } from "../../lib/core_engine";
import { formatClock, formatDuration, formatRemaining } from "../../lib/format";
import { useNow } from "../_components/use_now";
import { BackIcon } from "../_components/icons";
import RouteCard from "./RouteCard";

const RETRY_LATER = "잠시 후 다시 시도해 주세요";
const API_KEYS = ["sx", "sy", "ex", "ey", "deadline"] as const;

type Load =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "done"; result: FinalResult };

// 💡 주소창이 바뀌면 key가 바뀌어서 화면 상태(선택, 로딩)가 깨끗하게 새로 시작돼요
export default function RoutesView() {
    const params = useSearchParams();
    const apiQuery = new URLSearchParams(API_KEYS.map((k) => [k, params.get(k) ?? ""])).toString();
    return (
        <RoutesScreen
            key={apiQuery}
            apiQuery={apiQuery}
            destName={params.get("dest") || "도착지"}
            deadline={Number(params.get("deadline"))}
        />
    );
}

function RoutesScreen({ apiQuery, destName, deadline }: { apiQuery: string; destName: string; deadline: number }) {
    const now = useNow();
    const [load, setLoad] = useState<Load>({ status: "loading" });
    const [attempt, setAttempt] = useState(0); // "다시 시도"를 누르면 1 올려서 effect를 다시 돌려요
    const [selected, setSelected] = useState(0); // 첫 카드가 기본 선택

    useEffect(() => {
        let cancelled = false; // 💡 화면을 떠난 뒤 도착한 응답은 버려요
        fetch(`/api/routes?${apiQuery}`)
            .then(async (res) => {
                const body = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok || body === null) setLoad({ status: "error", message: body?.error?.message ?? RETRY_LATER });
                else setLoad({ status: "done", result: body as FinalResult });
            })
            .catch(() => {
                if (!cancelled) setLoad({ status: "error", message: RETRY_LATER });
            });
        return () => {
            cancelled = true;
        };
    }, [apiQuery, attempt]);

    const retry = () => {
        setLoad({ status: "loading" });
        setAttempt((n) => n + 1);
    };

    const options = load.status === "done" && load.result.ok ? load.result.options : null;

    return (
        <>
            {/* 지도 자리 (7단계에서 진짜 지도로 바꿔요) */}
            <div className="relative h-[180px] shrink-0 bg-map-ground">
                <div className="absolute inset-x-4 top-5 flex items-center gap-2.5 rounded-option bg-card py-2 pr-3.5 pl-2 shadow-[0_2px_8px_rgba(18,32,47,0.12)]">
                    <Link
                        href="/"
                        aria-label="입력 화면으로 돌아가기"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink"
                    >
                        <BackIcon />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-xs text-muted">내 위치 → 도착지</span>
                        <span className="truncate text-base font-bold">{destName}</span>
                    </div>
                </div>
            </div>

            {/* 아래 시트 */}
            <div className="relative -mt-5 flex flex-1 flex-col gap-3 rounded-t-[24px] bg-surface px-4 pt-4">
                <section className="flex flex-col gap-2 rounded-[18px] bg-ink px-[18px] py-4 text-white">
                    <div className="flex items-baseline justify-between text-[13px] text-border">
                        <span>도착 데드라인</span>
                        {now !== null && <span>지금 {formatClock(now)}</span>}
                    </div>
                    <div className="flex items-baseline gap-2.5">
                        <span className="text-[34px] leading-[1.2] font-black">
                            {Number.isFinite(deadline) && deadline > 0 ? formatClock(deadline) : "-"}
                        </span>
                        {now !== null && (
                            <span className="text-sm font-bold text-accent">{formatRemaining(deadline - now)}</span>
                        )}
                    </div>
                </section>

                {load.status === "loading" && <LoadingCards />}

                {load.status === "error" && (
                    <section className="flex flex-col items-start gap-3 rounded-card bg-card px-4 py-4" role="alert">
                        <p className="text-base font-bold">{load.message}</p>
                        <div className="flex gap-2">
                            <button type="button" onClick={retry} className="min-h-11 rounded-option bg-brand px-4 text-sm font-bold text-white">
                                다시 시도
                            </button>
                            <Link href="/" className="flex min-h-11 items-center rounded-option border border-border px-4 text-sm font-bold text-ink">
                                처음으로
                            </Link>
                        </div>
                    </section>
                )}

                {load.status === "done" && !load.result.ok && (
                    // 임시 화면이에요. 5단계 "제시간 도착 불가" 화면으로 바꿀 자리
                    <section className="flex flex-col gap-2 rounded-card border-2 border-dashed border-border bg-late-bg px-4 py-4">
                        <p className="text-lg font-black">제시간에 도착하는 경로가 없어요</p>
                        <p className="text-[15px] text-muted">
                            {load.result.fastestArrivalAt !== null && load.result.lateBy !== null
                                ? `가장 빨리 가도 ${formatClock(load.result.fastestArrivalAt)} 도착, ${formatDuration(load.result.lateBy)} 늦어요.`
                                : "지금 탈 수 있는 경로를 찾지 못했어요."}
                        </p>
                        <Link href="/" className="mt-1 text-sm font-bold text-brand">
                            데드라인 다시 정하기
                        </Link>
                    </section>
                )}

                {options && (
                    <>
                        <h2 className="px-0.5 pt-1 text-[13px] font-bold text-muted">제시간에 도착하는 방법</h2>
                        <ul className="flex flex-col gap-3">
                            {options.map((option, i) => (
                                <li key={i}>
                                    <RouteCard option={option} selected={i === selected} onSelect={() => setSelected(i)} />
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {/* 하단 버튼: 스크롤해도 바닥에 붙어 있어요 */}
                <div className="sticky bottom-0 mt-auto bg-surface pt-2 pb-5">
                    <button
                        type="button"
                        disabled
                        title="단계별 안내 화면은 4단계에서 연결해요"
                        className="min-h-[54px] w-full rounded-card bg-brand text-base font-bold text-white disabled:opacity-50"
                    >
                        이 경로로 안내 시작
                    </button>
                </div>
            </div>
        </>
    );
}

function LoadingCards() {
    return (
        <div className="flex flex-col gap-3" aria-busy="true">
            <p className="px-0.5 pt-1 text-[13px] font-bold text-muted">제시간에 가는 경로를 찾는 중이에요…</p>
            {[0, 1].map((i) => (
                <div key={i} className="h-[104px] animate-pulse rounded-card bg-card" />
            ))}
        </div>
    );
}
