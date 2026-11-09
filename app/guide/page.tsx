// 🚶 3. 이동 중 안내 화면 (목업 Guide · Guide-Bus · Guide-Walk · Map · Problem)
// 고른 경로는 주소창이 아니라 sessionStorage에서 읽어요 (목록 화면에서 저장).
import GuideView from "./GuideView";

export default function GuidePage() {
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-ink text-white">
            <GuideView />
        </main>
    );
}
