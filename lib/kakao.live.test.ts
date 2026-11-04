import { describe, it, expect, beforeAll } from "vitest";
import { KakaoResponse, KakaoRoute } from "./kakao_types";
// 💡 Vitest는 .env.local을 자동으로 안 읽어요. Node 22 내장 함수로 직접 불러와요.
//    파일이 없어도 테스트가 터지지 않게 try/catch로 감쌌어요.
try {
  process.loadEnvFile(".env.local");
} catch {}

const KEY = process.env.KAKAO_REST_API_KEY;
const URL = "https://dapi.kakao.com/v2/routing/publictraffic";

// 💡 진짜 API를 부르는 테스트라 호출 한도를 써요.
//    그래서 `npm test`를 할 때마다 돌지 않고, LIVE=1을 줬을 때만 돌게 막아 뒀어요.
const RUN = process.env.LIVE === "1" && !!KEY;

// 🗺️ 서울역 → 강남역 (x = 경도, y = 위도 순서예요! 반대로 넣는 실수를 많이 해요)
const SEOUL_STATION = { x: "126.9707", y: "37.5547" };
const GANGNAM_STATION = { x: "127.0276", y: "37.4979" };

// 요청 하나를 보내는 작은 도우미 함수예요
async function callKakao(key: string) {
  const params = new URLSearchParams({
    start_x: SEOUL_STATION.x,
    start_y: SEOUL_STATION.y,
    end_x: GANGNAM_STATION.x,
    end_y: GANGNAM_STATION.y,
  });
  // 💡 GET 요청: 데이터는 주소 뒤 ?start_x=... 로, 인증은 헤더로 보내요
  return fetch(`${URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` }, // "KakaoAK " 뒤에 띄어쓰기 한 칸 필수!
  });
}

describe.skipIf(!RUN)("카카오 대중교통 API (라이브)", () => {
  let body: KakaoResponse;
  let routes: KakaoRoute[]; // 💡 OK인 게 확인된 뒤의 경로들. 아래 테스트는 이걸 써요

  // 💡 응답을 한 번만 받아 와서 아래 테스트들이 같이 써요 → 호출 1번으로 끝나요
  beforeAll(async () => {
    const res = await callKakao(KEY!);
    console.log("HTTP 상태:", res.status, res.headers.get("content-type"));
    body = await res.json();
    // 처음 보는 응답이니까 통째로 한 번 찍어 봐요 (경로 1개만, 너무 길어서)
    console.log(JSON.stringify({ ...body, routes: body.routes?.slice(0, 1) }, null, 2));

    // 💡 여기서 status를 확인하면, 이 아래에선 TypeScript가 "routes가 무조건 있다"고 알아줘요
    //    실패면 여기서 멈춰서 진짜 원인 하나만 보여줘요 (줄줄이 실패 방지)
    if (body.status !== "OK") {
      throw new Error(`카카오 응답이 OK가 아니에요: ${JSON.stringify(body)}`);
    }
    routes = body.routes;
  });

  it("키가 통과되고 status가 OK다", () => {
    expect(body.status).toBe("OK");
    expect(routes.length).toBeGreaterThan(0);
  });

  it("step마다 type과 초 단위 time이 있다", () => {
    for (const step of routes[0].steps) {
      expect(["WALKING", "BUS", "SUBWAY"]).toContain(step.properties.type);
      expect(typeof step.properties.time).toBe("number");
    }
  });

  // 🔍 문서에 없던 두 가지를 눈으로 확인하는 테스트예요 (통과/실패보다 로그가 중요해요)
  it("[관찰] step time 합 vs totalTime, 차량 이름 형식", () => {
    for (const [i, route] of routes.entries()) {
      const sum = route.steps.reduce((acc, s) => acc + s.properties.time, 0);
      console.log(
        `경로 ${i}: totalTime=${route.properties.totalTime}, step 합=${sum}, 차이=${route.properties.totalTime - sum}`,
      );
      for (const s of route.steps) {
        if (s.properties.type !== "WALKING") {
          console.log(`  ${s.properties.type}:`, JSON.stringify(s.properties.vehicles));
        }
      }
    }
  });
});

// 💡 틀린 키를 넣으면 어떻게 거절당하는지도 봐 둬요 → 2-5 실패 처리 재료가 돼요
describe.skipIf(!RUN)("잘못된 키", () => {
  it("틀린 키는 2xx가 아니다", async () => {
    const res = await callKakao("wrong-key");
    console.log("틀린 키 응답:", res.status, await res.text());
    expect(res.ok).toBe(false);
  });
});