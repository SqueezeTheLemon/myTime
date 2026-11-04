// 🛣️ GET /api/routes?sx=..&sy=..&ex=..&ey=..&deadline=..
// 쿼리 검사 → 카카오 호출 → TotalRoute로 변환 → 엔진(makeList) → FinalResult 응답
import { makeList } from "../../../lib/core_engine";
import { kakaoToTotalRoutes } from "../../../lib/kakao_convert";
import { fetchKakaoTransit } from "../../../lib/kakao_client";
import { parseRouteQuery } from "../../../lib/route_query";

// 실패 응답은 모양을 하나로 맞춰요 → 화면에서 error.message만 보여주면 돼요
function fail(status: number, code: string, message: string) {
    return Response.json({ error: { code, message } }, { status });
}

const RETRY_LATER = "잠시 후 다시 시도해 주세요";

export async function GET(request: Request) {
    // 🕑 "지금"은 입구에서 딱 한 번만 정해요. 엔진 안에선 Date를 안 써요
    const now = Math.floor(Date.now() / 1000);

    // 1) 입력 검사 → 잘못된 요청이면 400
    const parsed = parseRouteQuery(new URL(request.url).searchParams, now);
    if (!parsed.ok) return fail(400, "bad_request", parsed.message);
    const { start, end, deadline } = parsed.query;

    // 2) 카카오 호출 → 실패 이유별로 상태 코드를 나눠요
    const kakao = await fetchKakaoTransit(start, end);
    if (!kakao.ok) {
        switch (kakao.reason) {
            case "quota":
                return fail(503, "quota", RETRY_LATER); // 무료 한도 초과
            case "no_key":
            case "auth":
                console.error("카카오 키 설정 문제:", kakao.reason); // 💡 원인은 서버 로그에만!
                return fail(500, "server_config", RETRY_LATER);
            case "upstream":
                return fail(502, "upstream", RETRY_LATER);
        }
    }

    // 3) 카카오가 "이 좌표로는 길찾기 불가"라고 한 경우 → 400
    //    (NO_RESULTS는 아래에서 "갈 수 있는 경로 없음"으로 자연스럽게 처리돼요)
    const status = kakao.data.status;
    if (status !== "OK" && status !== "NO_RESULTS") {
        const message =
            status === "EQUAL_POINTS" ? "출발지와 도착지가 같아요" : "출발지나 도착지 근처에서 길을 찾을 수 없어요";
        return fail(400, status.toLowerCase(), message);
    }

    // 4) 변환 → 엔진. 여기부턴 1·2-2단계에서 만든 순수 함수들이에요
    const routes = kakaoToTotalRoutes(kakao.data, now);
    return Response.json(makeList(now, deadline, routes));
}