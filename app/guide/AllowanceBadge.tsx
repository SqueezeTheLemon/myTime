// 노란 여유 배지: "여유 1분" / "여유 1분 미만" / "2분 늦음" (안내·지도 화면 공용)
import { formatAllowance } from "../../lib/ui/format";
import type { GuideSession } from "../../lib/ui/guide";

export default function AllowanceBadge({ session }: { session: GuideSession }) {
    return (
        <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-ink">{formatAllowance(session.option.evaluation)}</span>
    );
}
