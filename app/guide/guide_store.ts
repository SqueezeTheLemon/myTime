"use client";
// 💾 고른 경로를 sessionStorage에 두고 꺼내 쓰는 작은 저장소예요.
// 💡 sessionStorage는 탭 하나에만 살아 있어서, 새로고침해도 남고 탭을 닫으면 사라져요. 안내 화면에 딱 맞죠.
// 💡 서버에는 sessionStorage가 없으니, useNow처럼 useSyncExternalStore로 "서버에선 undefined"를 줘요.
import { useMemo, useSyncExternalStore } from "react";
import { GuideSession, parseGuideSession } from "../../lib/ui/guide";

const KEY = "mytime:guide";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
}

// 💡 문자열을 그대로 돌려줘야 해요. 매번 JSON.parse한 새 객체를 주면 "값이 바뀌었다"고 보고 무한 렌더돼요.
function getSnapshot(): string | null {
    try {
        return sessionStorage.getItem(KEY);
    } catch {
        return null; // 사생활 보호 모드 등에서 막힐 수 있어요
    }
}

function getServerSnapshot(): undefined {
    return undefined;
}

function write(value: GuideSession) {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(value));
    } catch {
        // 저장이 안 되면 안내 화면에서 "경로가 없어요"로 보여줘요
    }
    listeners.forEach((fn) => fn());
}

// 💡 둘 다 버튼을 누를 때(이벤트 핸들러)만 불러요. 그래서 여기서 Date.now()를 써도 렌더가 흔들리지 않아요.
const nowSeconds = () => Math.floor(Date.now() / 1000);

export function saveGuide(session: Omit<GuideSession, "version" | "step" | "startedAt" | "arrivedAt">) {
    write({ ...session, version: 1, step: 0, startedAt: nowSeconds() });
}

// 마지막 단계를 넘기면 그 순간을 도착 시각으로 적고, 되돌아가면 지워요
export function setGuideStep(session: GuideSession, step: number) {
    const finished = step >= session.option.route.length;
    write({ ...session, step, arrivedAt: finished ? nowSeconds() : undefined });
}

// undefined = 아직 못 읽음(서버), null = 저장된 경로 없음
export function useGuideSession(): GuideSession | null | undefined {
    const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return useMemo(() => (raw === undefined ? undefined : parseGuideSession(raw)), [raw]);
}
