import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 💡 Noto Sans KR은 가변 폰트라 weight를 안 적어도 400~900을 다 써요.
// subsets에 'korean'은 없어요 → 한글 글리프는 Google이 unicode-range로 쪼개서 필요할 때 받아요.
// 그래서 preload는 latin 조각만 돼요 (괜찮아요!).
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "제시간",
  description: "도착 시각에 맞춰 갈 수 있는 서울 대중교통 경로를 알려줘요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
