// 🧪 테스트용 카카오 응답 샘플이에요 (서울역 → 강남역 관찰 결과를 보고 손으로 줄여 만든 것)
// 💡 실제 응답을 통째로 저장하지 않고, 필요한 필드만 남겨 직접 만들었어요.
//    JSON 대신 .ts로 두면 타입이 틀렸을 때 바로 빨간 줄이 떠요!
import { KakaoResponse, KakaoStep } from "../transit_types";

// step을 짧게 만드는 도우미 (guidance, path처럼 엔진이 안 쓰는 건 대충 채워요)
const walk = (time: number): KakaoStep => ({
    properties: { guidance: "도보", type: "WALKING", distance: 0, time, stops: [], vehicles: [] },
    path: { points: [] },
});

const ride = (type: "BUS" | "SUBWAY", time: number, names: string[]): KakaoStep => ({
    properties: {
        guidance: names.join(", "),
        type,
        distance: 0,
        time,
        stops: [{ name: "출발 정류장" }, { name: "도착 정류장" }],
        vehicles: names.map((name) => ({ name, type: "일반" })),
    },
    path: { points: [] },
});

// 💡 `: KakaoResponse` 대신 `satisfies`를 쓰면 "OK 응답"이라는 게 기억돼서
//    테스트에서 okResponse.routes를 쓸 때 `!`를 안 붙여도 돼요
export const okResponse = {
    status: "OK",
    properties: { total: 2, bus: 1, subway: 1, busAndSubway: 0, landingURL: "https://map.kakao.com" },
    routes: [
        // 경로 0: 도보 5분 → 4호선 10분 → 2호선 15분 → 도보 3분
        {
            properties: { type: "SUBWAY", totalDistance: 0, totalTime: 2177, transfers: 1 },
            steps: [walk(300), ride("SUBWAY", 600, ["4호선", "4호선"]), ride("SUBWAY", 900, ["2호선"]), walk(180)],
        },
        // 경로 1: 도보 4분 → 버스(후보 3개) 30분 → 도보 2분
        {
            properties: { type: "BUS", totalDistance: 0, totalTime: 2301, transfers: 0 },
            steps: [walk(240), ride("BUS", 1800, ["104", "463", "N16(심야)"]), walk(120)],
        },
    ],
} satisfies KakaoResponse;

// ─────────────────────────────────────────────────────────────
// 🚶 실제 카카오 응답 모양 (2026-11-09, 서울시청 → 잠실 실측을 줄여 만듦)
// 💡 위 okResponse와 달리 "처음·마지막 도보" step이 없어요. 이게 진짜 모양!
//    대신 path.points(정류장 좌표)와 totalDistance(도보 포함 전체 거리)가 있어요.
// ─────────────────────────────────────────────────────────────
export const REAL_START = { x: 126.978, y: 37.5665 }; // 서울시청
export const REAL_END = { x: 127.1, y: 37.5133 }; // 잠실 근처

const realStep = (
    type: "BUS" | "SUBWAY" | "WALKING",
    time: number,
    distance: number,
    points: number[][],
    names: string[] = [],
): KakaoStep => ({
    properties: {
        guidance: names.join(", "),
        type,
        distance,
        time,
        stops: [],
        vehicles: names.map((name) => ({ name, type: "일반" })),
    },
    path: { points },
});

export const realShapeResponse = {
    status: "OK",
    properties: { total: 2, bus: 0, subway: 2, busAndSubway: 0, landingURL: "https://map.kakao.com" },
    routes: [
        // 경로 0: 2호선 하나. 출발지에서 을지로입구역까지 약 370m, 마지막 역에서 목적지까지 약 20m
        {
            properties: { type: "SUBWAY", totalDistance: 14867, totalTime: 2135, transfers: 0 },
            steps: [realStep("SUBWAY", 1590, 14400, [[126.98219301, 37.56603726], [127.1, 37.51348]], ["2호선"])],
        },
        // 경로 1: 1호선 → 환승 도보 → 9호선. 출발지 약 150m, 목적지까지 약 1.1km
        {
            properties: { type: "SUBWAY", totalDistance: 24521, totalTime: 3828, transfers: 1 },
            steps: [
                realStep("SUBWAY", 690, 9000, [[126.97719927, 37.56534461], [127.02, 37.53]], ["1호선"]),
                realStep("WALKING", 171, 111, [[127.02, 37.53], [127.021, 37.53]]),
                realStep("SUBWAY", 1395, 13900, [[127.021, 37.53], [127.1, 37.5232]], ["9호선"]),
            ],
        },
    ],
} satisfies KakaoResponse;

export const noResultResponse = {
    status: "NO_RESULTS",
    properties: { total: 0, bus: 0, subway: 0, busAndSubway: 0, landingURL: "https://map.kakao.com" },
} satisfies KakaoResponse;