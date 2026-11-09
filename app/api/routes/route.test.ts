import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { okResponse, noResultResponse } from "../../../lib/kakao/fixtures/kakao_sample";

// 🕑 Date.now()를 고정해요 → route.ts의 now가 항상 같은 값이 돼요
const NOW = 1_800_000_000;
const URL_BASE = "http://localhost/api/routes";
const goodQuery = `sx=126.9707&sy=37.5547&ex=127.0276&ey=37.4979&deadline=${NOW + 3600}`;

// 💡 진짜 카카오 대신 "가짜 fetch"를 끼워요. 네트워크도 한도도 안 써요
function mockKakao(status: number, body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

const call = (query: string) => GET(new Request(`${URL_BASE}?${query}`));

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000); // 밀리초 단위예요!
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("GET /api/routes", () => {
    it("성공하면 200 + FinalResult", async () => {
        const fetchMock = mockKakao(200, okResponse);
        const res = await call(goodQuery);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.options[0].arrivalAt).toBe(NOW + 2100);
        // 카카오에 키를 헤더로 잘 실어 보냈는지도 확인해요
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("KakaoAK test-key");
    });

    it("입력이 잘못되면 400이고, 카카오는 부르지도 않아요", async () => {
        const fetchMock = mockKakao(200, okResponse);
        const res = await call("sx=abc");

        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe("bad_request");
        expect(fetchMock).not.toHaveBeenCalled(); // 💡 한도를 아끼는 포인트!
    });

    it("카카오 한도 초과(429)면 503 + 잠시 후 다시", async () => {
        mockKakao(429, {});
        const res = await call(goodQuery);

        expect(res.status).toBe(503);
        expect((await res.json()).error.message).toBe("잠시 후 다시 시도해 주세요");
    });

    it("키가 틀리면(401) 500, 원인은 사용자에게 안 보여요", async () => {
        mockKakao(401, { errorType: "AccessDeniedError" });
        vi.spyOn(console, "error").mockImplementation(() => {}); // 테스트 출력 조용히
        const res = await call(goodQuery);

        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain("AccessDenied");
    });

    it("키가 아예 없으면 카카오를 부르지 않고 500", async () => {
        vi.stubEnv("KAKAO_REST_API_KEY", "");
        vi.spyOn(console, "error").mockImplementation(() => {});
        const fetchMock = mockKakao(200, okResponse);

        expect((await call(goodQuery)).status).toBe(500);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("네트워크 오류면 502", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
        expect((await call(goodQuery)).status).toBe(502);
    });

    it("출발지 = 도착지(EQUAL_POINTS)면 400", async () => {
        mockKakao(200, { ...noResultResponse, status: "EQUAL_POINTS" });
        const res = await call(goodQuery);

        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe("equal_points");
    });

    it("경로가 없으면(NO_RESULTS) 200 + ok:false", async () => {
        mockKakao(200, noResultResponse);
        const res = await call(goodQuery);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: false, fastestArrivalAt: null, lateBy: null });
    });
});