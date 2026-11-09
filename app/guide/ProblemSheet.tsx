"use client";
// 🆘 4. 문제가 생겼을 때 (목업 Problem). 아래에서 올라오는 시트예요.
// "다시 계산하기"는 5단계에서 연결해요. 지금은 이유만 고를 수 있어요.
import { useEffect, useState } from "react";

const REASONS = ["버스를 놓쳤어요", "지하철을 놓쳤어요", "길을 잘못 들었어요", "차가 막혀요 / 지하철이 연착돼요"] as const;

export default function ProblemSheet({ label, onClose }: { label: string; onClose: () => void }) {
    const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);

    // Esc로 닫기
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-10 mx-auto flex w-full max-w-[390px] flex-col bg-scrim pt-[30px]" role="dialog" aria-modal="true" aria-labelledby="problem-title">
            <button type="button" onClick={onClose} className="mx-auto min-h-11 px-4 text-sm text-[#d5dde5]">
                이동 중 안내로 돌아가기
            </button>
            <div className="mt-auto flex flex-col gap-3 rounded-t-[26px] bg-card px-[18px] pt-[22px] pb-6 text-ink">
                <h2 id="problem-title" className="text-2xl font-black">
                    {label} - 무슨 일이 있었나요?
                </h2>
                <p className="text-sm text-muted">알려주시면 지금부터 다시 계산해요.</p>
                <div className="flex flex-col gap-3" role="radiogroup" aria-label="무슨 일이 있었나요">
                    {REASONS.map((r) => {
                        const on = r === reason;
                        return (
                            <button
                                key={r}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setReason(r)}
                                className={`min-h-[52px] w-full rounded-option px-4 text-left text-base ${
                                    on ? "bg-brand-tint font-bold shadow-[inset_0_0_0_2px_var(--color-brand)]" : "bg-surface font-medium"
                                }`}
                            >
                                {r}
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    disabled
                    title="다시 계산은 5단계에서 연결해요"
                    className="min-h-[54px] w-full rounded-card bg-brand text-base font-bold text-white disabled:opacity-50"
                >
                    다시 계산하기
                </button>
            </div>
        </div>
    );
}
