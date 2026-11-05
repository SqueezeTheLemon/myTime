// 📱 1. 직접 입력 화면
// 💡 page는 서버 컴포넌트로 두고, 상태가 필요한 폼만 클라이언트 컴포넌트로 분리했어요.
import InputForm from "./_components/InputForm";

export default function Home() {
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col px-4 pt-6 pb-5">
            <InputForm />
        </main>
    );
}
