// 🧪 테스트용 카카오 응답 샘플이에요 (서울역 → 강남역 관찰 결과를 보고 손으로 줄여 만든 것)
// 💡 실제 응답을 통째로 저장하지 않고, 필요한 필드만 남겨 직접 만들었어요.
//    JSON 대신 .ts로 두면 타입이 틀렸을 때 바로 빨간 줄이 떠요!
import { KakaoResponse, KakaoStep } from "../kakao_types";

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

export const noResultResponse = {
    status: "NO_RESULTS",
    properties: { total: 0, bus: 0, subway: 0, busAndSubway: 0, landingURL: "https://map.kakao.com" },
} satisfies KakaoResponse;