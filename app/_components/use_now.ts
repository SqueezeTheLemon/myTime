"use client";
// 🕑 화면에 보여줄 "지금" (epoch초). 5초마다 다시 그려요.
// 💡 렌더 중에 Date.now()를 바로 부르면 서버 HTML과 브라우저 값이 달라져요(하이드레이션 경고).
//    useSyncExternalStore는 서버에선 null, 브라우저에선 실제 시각을 주니까 그 문제가 없어요.
import { useSyncExternalStore } from "react";
import type { EpochSeconds } from "../../lib/core_engine";

const TICK_SECONDS = 5;

function subscribe(onChange: () => void) {
    const id = setInterval(onChange, TICK_SECONDS * 1000);
    return () => clearInterval(id);
}

// 5초 단위로 내려야 같은 구간 안에서는 같은 값이 나와요 (계속 바뀌면 무한 렌더!)
function getSnapshot(): EpochSeconds {
    return Math.floor(Date.now() / 1000 / TICK_SECONDS) * TICK_SECONDS;
}

function getServerSnapshot(): null {
    return null;
}

export function useNow(): EpochSeconds | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
