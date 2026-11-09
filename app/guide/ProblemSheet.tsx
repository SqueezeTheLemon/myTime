"use client";
// 🆘 4. 문제가 생겼을 때 (목업 Problem). 아래에서 올라오는 시트예요.
// "다시 계산하기" → 지금 위치를 한 번 확인 → 출발지만 바꿔서 경로 목록(/routes)을 다시 열어요.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RECALC_REASONS, recalcQuery, type RecalcReason } from "../../lib/ui/result";
import { requestPosition } from "../_components/request_position";

const REASON_KEYS = Object.keys(RECALC_REASONS) as RecalcReason[];

type Locate = { status: "idle" } | { status: "locating" } | { status: "error"; message: string };

interface Props {
    label: string; // 지금 단계 이름 ("도보 2분 · 정류장까지")
    defaultReason: RecalcReason;
    routesQuery: string; // 원래 목록 주소 (도착지·데드라인이 들어 있어요)
    onClose: () => void;
}

export default function ProblemSheet({ label, defaultReason, routesQuery, onClose }: Props) {
    const router = useRouter();
    const [reason, setReason] = useState<RecalcReason>(defaultReason);
    const [locate, setLocate] = useState<Locate>({ status: "idle" });

    // Esc로 닫기
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const recalc = () => {
        setLocate({ status: "locating" });
        requestPosition(
            (point) => router.push(`/routes?${recalcQuery(routesQuery, point, reason, Math.floor(Date.now() / 1000))}`),
            (message) => setLocate({ status: "error", message }),
        );
    };

    return (
        <div className="fixed inset-0 z-10 mx-auto flex w-full max-w-[390px] flex-col bg-scrim pt-[30px]" role="dialog" aria-modal="true" aria-labelledby="problem-title">
            <button type="button" onClick={onClose} className="mx-auto min-h-11 px-4 text-sm text-[#d5dde5]">
                이동 중 안내로 돌아가기
            </button>
            <div className="mt-auto flex flex-col gap-3 rounded-t-[26px] bg-card px-[18px] pt-[22px] pb-6 text-ink">
                <h2 id="problem-title" className="text-2xl font-black">
                    {label} - 무슨 일이 있었나요?
                </h2>
                <p className="text-sm text-muted">알려주시면 지금 위치에서 다시 계산해요.</p>
                <div className="flex flex-col gap-3" role="radiogroup" aria-label="무슨 일이 있었나요">
                    {REASON_KEYS.map((key) => {
                        const on = key === reason;
                        return (
                            <button
                                key={key}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setReason(key)}
                                className={`min-h-[52px] w-full rounded-option px-4 text-left text-base ${
                                    on ? "bg-brand-tint font-bold shadow-[inset_0_0_0_2px_var(--color-brand)]" : "bg-surface font-medium"
                                }`}
                            >
                                {RECALC_REASONS[key].label}
                            </button>
                        );
                    })}
                </div>
                {locate.status === "error" && (
                    <p className="text-sm font-bold text-warn-ink" role="alert">
                        {locate.message}
                    </p>
                )}
                <button
                    type="button"
                    onClick={recalc}
                    disabled={locate.status === "locating"}
                    className="min-h-[54px] w-full rounded-card bg-brand text-base font-bold text-white disabled:opacity-60"
                >
                    {locate.status === "locating" ? "지금 위치를 확인하는 중…" : "다시 계산하기"}
                </button>
            </div>
        </div>
    );
}
