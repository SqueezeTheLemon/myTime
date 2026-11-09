"use client";
// 📝 1. 직접 입력 화면 (목업 Main). 출발지(GPS 1회) + 도착지(장소 검색) + 데드라인 → /routes로 이동
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Point } from "../../lib/routes/route_query";
import type { Place, PlacesResponse } from "../../lib/places/place_types";
import { dayLabel, deadlineFromTime, minutesLater, nextOClock, toTimeValue } from "../../lib/ui/deadline";
import { formatClock, formatRemaining } from "../../lib/ui/format";
import { useNow } from "./use_now";
import { CheckIcon, LocateIcon, Logo, SearchIcon } from "./icons";

const RETRY_LATER = "잠시 후 다시 시도해 주세요";

type Origin =
    | { status: "locating" }
    | { status: "ok"; point: Point }
    | { status: "error"; message: string };

type Search =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; places: Place[] }
    | { status: "error"; message: string };

// 💡 GPS는 "지금 한 번만" 물어봐요. 계속 추적하지 않는 게 앱 규칙이에요.
function requestPosition(onOk: (p: Point) => void, onError: (message: string) => void) {
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

export default function InputForm() {
    const router = useRouter();
    const now = useNow();

    // ── 출발지 ──
    const [origin, setOrigin] = useState<Origin>({ status: "locating" });
    const locate = () =>
        requestPosition(
            (point) => setOrigin({ status: "ok", point }),
            (message) => setOrigin({ status: "error", message }),
        );
    useEffect(locate, []); // 화면이 열릴 때 한 번
    const relocate = () => {
        setOrigin({ status: "locating" });
        locate();
    };

    // ── 도착지 ──
    const [query, setQuery] = useState("");
    const [search, setSearch] = useState<Search>({ status: "idle" });
    const [dest, setDest] = useState<Place | null>(null);
    const latestSearch = useRef(0); // 💡 검색을 연달아 누르면 마지막 응답만 반영해요

    const onQueryChange = (value: string) => {
        setQuery(value);
        if (dest && value !== dest.name) setDest(null); // 글자를 고치면 고른 장소는 취소
    };

    const onSearch = async (e: FormEvent) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;

        const id = ++latestSearch.current;
        setSearch({ status: "loading" });
        try {
            const res = await fetch(`/api/places?query=${encodeURIComponent(q)}`);
            const body = await res.json().catch(() => null);
            if (id !== latestSearch.current) return;
            if (!res.ok) {
                setSearch({ status: "error", message: body?.error?.message ?? RETRY_LATER });
                return;
            }
            setSearch({ status: "done", places: (body as PlacesResponse).places });
        } catch {
            if (id === latestSearch.current) setSearch({ status: "error", message: RETRY_LATER });
        }
    };

    const pick = (place: Place) => {
        setDest(place);
        setQuery(place.name);
        setSearch({ status: "idle" });
    };

    // ── 데드라인 ──
    const [time, setTime] = useState(""); // "HH:MM"
    const nowDate = now === null ? null : new Date(now * 1000);
    const deadline = nowDate && time ? deadlineFromTime(nowDate, time) : null;
    const setChip = (target: Date) => setTime(toTimeValue(target));
    // 💡 칩은 누르는 "순간"의 시각 기준이라 이벤트 핸들러 안에서 new Date()를 써요
    const chips = [
        { label: "15분 뒤", make: () => minutesLater(new Date(), 15) },
        { label: "30분 뒤", make: () => minutesLater(new Date(), 30) },
        { label: "정각으로", make: () => nextOClock(new Date()) },
    ];

    // ── 경로 찾기 ──
    const missing =
        origin.status !== "ok"
            ? "현재 위치를 확인해야 해요"
            : !dest
              ? "도착지를 검색해서 골라 주세요"
              : !time
                ? "도착 데드라인을 정해 주세요"
                : null;

    const findRoutes = () => {
        if (origin.status !== "ok" || !dest) return;
        // 누르는 순간 다시 계산해요 (화면을 오래 켜뒀다가 누를 수도 있으니까요)
        const at = deadlineFromTime(new Date(), time);
        if (!at) return;
        const params = new URLSearchParams({
            sx: String(origin.point.x),
            sy: String(origin.point.y),
            ex: String(dest.x),
            ey: String(dest.y),
            deadline: String(Math.floor(at.getTime() / 1000)),
            dest: dest.name,
        });
        router.push(`/routes?${params}`);
    };

    return (
        <div className="flex flex-1 flex-col gap-3.5">
            <header className="flex items-center gap-2.5">
                <Logo />
                <span className="text-xl font-black">제시간</span>
                <span className="text-[13px] text-muted">myTime</span>
            </header>

            <h1 className="text-[28px] leading-[1.3] font-black">
                어디까지, 몇 시까지
                <br />
                가야 하나요?
            </h1>

            {/* 출발지 */}
            <section className="flex items-center gap-3 rounded-card bg-card px-4 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-brand-tint text-brand">
                    <LocateIcon />
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-xs text-muted">출발지</span>
                    <span className="text-lg font-bold">현재 위치</span>
                    <span
                        className={`text-xs ${origin.status === "error" ? "font-bold text-warn-ink" : "text-muted"}`}
                        aria-live="polite"
                    >
                        {origin.status === "locating" && "위치를 확인하는 중이에요…"}
                        {origin.status === "ok" && "GPS로 지금 한 번만 확인했어요"}
                        {origin.status === "error" && origin.message}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={relocate}
                    disabled={origin.status === "locating"}
                    className="min-h-11 px-1 text-[13px] font-bold text-brand disabled:opacity-40"
                >
                    다시 확인
                </button>
            </section>

            {/* 도착지 */}
            <section className="flex flex-col gap-2 rounded-card bg-card px-4 py-3">
                <form onSubmit={onSearch} className="flex items-center gap-2.5" role="search">
                    <div className="flex flex-1 flex-col gap-1">
                        <label htmlFor="dest" className="text-xs text-muted">
                            도착지
                        </label>
                        <input
                            id="dest"
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            placeholder="장소 이름을 입력하세요"
                            autoComplete="off"
                            enterKeyHint="search"
                            className="w-full bg-transparent text-xl font-bold placeholder:font-medium placeholder:text-border focus:outline-none"
                        />
                    </div>
                    {dest ? (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                            <CheckIcon />
                            <span className="sr-only">도착지를 골랐어요</span>
                        </span>
                    ) : (
                        <button
                            type="submit"
                            aria-label="도착지 검색"
                            disabled={search.status === "loading"}
                            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-60"
                        >
                            <SearchIcon />
                        </button>
                    )}
                </form>

                {search.status === "loading" && <p className="text-[13px] text-muted">찾는 중이에요…</p>}
                {search.status === "error" && (
                    <p className="text-[13px] font-bold text-warn-ink" role="alert">
                        {search.message}
                    </p>
                )}
                {search.status === "done" &&
                    (search.places.length === 0 ? (
                        <p className="text-[13px] text-muted">검색 결과가 없어요. 다른 이름으로 찾아보세요.</p>
                    ) : (
                        <ul className="flex flex-col border-t border-chip">
                            {search.places.map((place) => (
                                <li key={place.id}>
                                    <button
                                        type="button"
                                        onClick={() => pick(place)}
                                        className="flex min-h-12 w-full flex-col items-start gap-0.5 border-b border-chip py-2 text-left"
                                    >
                                        <span className="text-[15px] font-bold">{place.name}</span>
                                        <span className="text-xs text-muted">{place.address}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ))}
            </section>

            {/* 도착 데드라인 */}
            <section className="flex flex-col gap-1 rounded-card bg-card px-4 py-3">
                <label htmlFor="deadline" className="text-xs text-muted">
                    도착 데드라인
                </label>
                <input
                    id="deadline"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-transparent text-[34px] leading-[1.2] font-black focus:outline-none"
                />
                {deadline && nowDate && now !== null && (
                    <p className="text-[13px] text-muted">
                        {dayLabel(nowDate, deadline)} {formatClock(deadline.getTime() / 1000)}까지 ·{" "}
                        <b className="text-ink">{formatRemaining(deadline.getTime() / 1000 - now)}</b>
                    </p>
                )}
                <div className="flex gap-2 pt-2">
                    {chips.map((chip) => (
                        <button
                            key={chip.label}
                            type="button"
                            onClick={() => setChip(chip.make())}
                            className="min-h-9 rounded-full bg-chip px-3.5 py-2 text-[13px]"
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            </section>

            <div className="mt-auto flex flex-col gap-2 pt-2">
                {missing && <p className="text-center text-[13px] text-muted">{missing}</p>}
                <button
                    type="button"
                    onClick={findRoutes}
                    disabled={missing !== null}
                    className="min-h-[54px] w-full rounded-card bg-brand text-base font-bold text-white disabled:bg-border"
                >
                    경로 찾기
                </button>
            </div>
        </div>
    );
}
