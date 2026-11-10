// 🗂️ 경로 카드 한 장 (목업 "2. 경로 목록" Routes-3)
// 예: [2:29 도착] [정시 도착 가능]            여유 1분
//     [도보 3분 → 2분] › [740번 버스 11분] › [도보 2분]
import { Fragment } from "react";
import type { RouteOption } from "../../lib/engine/core_engine";
import { EVALUATION_BADGE, formatAllowance, formatDuration, formatSpeedUp, segmentName, shortClock } from "../../lib/ui/format";
import { ChevronRight } from "../_components/icons";

const BADGE_CLASS = {
    ahead: "bg-brand text-white",
    tight: "bg-warn-bg text-warn-ink",
    delayed: "border-[1.5px] border-late text-late",
} as const;

interface Props {
    option: RouteOption;
    selected: boolean;
    onSelect: () => void;
}

export default function RouteCard({ option, selected, onSelect }: Props) {
    const { evaluate } = option.evaluation;
    const late = evaluate === "delayed";
    // 💡 speedUps는 "몇 번째 구간인지"로 오니까 Map으로 바꿔두면 칩 그릴 때 바로 찾을 수 있어요
    const limits = new Map(option.speedUps.map((s) => [s.segmentIndex, s.timeLimit]));

    // 테두리: 선택 = 파란 실선, 늦는 경로 = 회색 점선, 나머지 = 없음(자리만 잡아서 선택해도 안 흔들리게)
    const border = selected ? "border-2 border-brand" : late ? "border-2 border-dashed border-border" : "border-2 border-transparent";

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`flex w-full flex-col gap-2.5 rounded-card px-4 py-3.5 text-left ${late ? "bg-late-bg" : "bg-card"} ${border}`}
        >
            <div className="flex w-full items-baseline justify-between">
                <div className="flex items-center gap-2">
                    <span className={`text-lg font-black ${late ? "text-muted" : ""}`}>{shortClock(option.arrivalAt)} 도착</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${BADGE_CLASS[evaluate]}`}>
                        {EVALUATION_BADGE[evaluate]}
                    </span>
                </div>
                <span className={`text-[13px] ${late ? "font-bold text-late" : "text-muted"}`}>
                    {formatAllowance(option.evaluation)}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {option.route.map((seg, i) => {
                    const limit = limits.get(i);
                    return (
                        <Fragment key={i}>
                            {i > 0 && (
                                <span className="text-muted">
                                    <ChevronRight />
                                </span>
                            )}
                            {limit !== undefined ? (
                                // 빨리 걸어야 하는 도보: 노란 칩 + "원래 → 제한"
                                <span className="rounded-[10px] bg-accent px-2.5 py-1.5 text-sm font-bold">
                                    {segmentName(seg)} {formatSpeedUp(seg.time, limit).from} →{" "}
                                    <b className="font-black">{formatSpeedUp(seg.time, limit).to}</b>
                                </span>
                            ) : (
                                <span className="rounded-[10px] bg-surface px-2.5 py-1.5 text-sm font-medium">
                                    {segmentName(seg)} {formatDuration(seg.time)}
                                </span>
                            )}
                        </Fragment>
                    );
                })}
            </div>
        </button>
    );
}
