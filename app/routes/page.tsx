// 📋 2. 경로 목록 화면
// 💡 cacheComponents가 켜져 있어서, 주소창 값(useSearchParams)을 읽는 부분은 Suspense로 감싸야
//    나머지 껍데기를 미리 그려둘 수 있어요 (Next 16 문서: use-search-params.md "Prerendering").
import { Suspense } from "react";
import RoutesView from "./RoutesView";

export default function RoutesPage() {
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col">
            <Suspense fallback={<div className="h-[180px] bg-map-ground" />}>
                <RoutesView />
            </Suspense>
        </main>
    );
}
