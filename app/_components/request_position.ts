"use client";
// 📍 지금 위치를 한 번만 물어봐요 (입력 화면, 다시 계산에서 같이 써요)
import type { Point } from "../../lib/routes/route_query";

// 💡 GPS는 "지금 한 번만" 물어봐요. 계속 추적하지 않는 게 앱 규칙이에요.
export function requestPosition(onOk: (p: Point) => void, onError: (message: string) => void) {
    if (!("geolocation" in navigator)) {
        // 콜백처럼 비동기로 알려야 effect 안에서 setState를 바로 부르지 않아요
        setTimeout(() => onError("이 브라우저는 위치 확인을 지원하지 않아요"), 0);
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => onOk({ x: pos.coords.longitude, y: pos.coords.latitude }),
        (err) =>
            onError(
                err.code === err.PERMISSION_DENIED
                    ? "위치 권한을 허용해 주세요"
                    : "현재 위치를 확인하지 못했어요",
            ),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
}
