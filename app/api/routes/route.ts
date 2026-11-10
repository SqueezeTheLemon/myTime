// 쿼리 검사 → 카카오 호출 → 지하철·버스 실시간 조회 → TotalRoute로 변환 → 엔진(makeList) → FinalResult 응답

import { makeList } from "../../../lib/engine/core_engine";
import { EtaLookup, kakaoToTotalRoutes } from "../../../lib/kakao/transit_convert";
import { loadBusLookup } from "../../../lib/bus/bus_realtime";
import { fetchKakaoTransit } from "../../../lib/kakao/transit_client";
import { parseRouteQuery } from "../../../lib/routes/route_query";
import { loadSubwayLookup } from "../../../lib/subway/subway_realtime";

// 실패 응답은 모양을 하나로 맞추고 → 화면에선 error.message만 보여준다.
function fail(status: number, code: string, message: string) {
    return Response.json({error : {code, message}}, {status});
}

const RETRY_LATER = "잠시 후 다시 시도해 주세요";

export async function GET(request: Request) {

    const now = Math.floor(Date.now() / 1000); // 현재시간 받아오기 

    // 1) 입력 검사 → 잘못된 요청이면 400
    const parsed = parseRouteQuery(new URL(request.url).searchParams, now);
    if(!parsed.ok) return fail(400, "bad_request", parsed.message);
    const {start, end, deadline} = parsed.query; // 괜찮은 입력이면 start, end, deadline으로 카카오에 넣을 준비 

    // 2) 카카오 호출 → 실패 이유별로 상태 코드를 나눔
    const kakao = await fetchKakaoTransit(start, end);
    if(!kakao.ok){
        switch (kakao.reason){
            case "quota" : return fail (503, "quota", RETRY_LATER)
            case "no_key" :
            case "auth" : 
                console.error("카카오 키 설정 문제:", kakao.reason); 
                return fail(500, "server_config", RETRY_LATER);
            case "upstream":
                return fail (502, "upstream", RETRY_LATER);
        }
    }

    // 3) 카카오가 "이 좌표로는 길찾기 불가"라고 한 경우 → 400
    const status = kakao.data.status;
    if (status !== "OK" && status !== "NO_RESULTS") {
        const message =
            status === "EQUAL_POINTS" ? "출발지와 도착지가 같아요" : "출발지나 도착지 근처에서 길을 찾을 수 없어요";
        return fail(400, status.toLowerCase(), message);
    }

    // 4) 실시간 도착 정보: 지하철·버스를 동시에 조회해요. 실패해도 placeholder로 계속 가요
    const [subway, bus] = await Promise.all([loadSubwayLookup(kakao.data, now), loadBusLookup(kakao.data, now)]);
    // 💡 둘 다 자기 교통수단이 아니면 null을 줘서, 그냥 앞에서부터 물어보면 돼요
    const etaFor: EtaLookup = (step, earliest) => subway(step, earliest) ?? bus(step, earliest);

    // 5) 변환 → 엔진. 출발지·목적지를 같이 넘겨야 처음·마지막 도보가 붙어요
    const routes = kakaoToTotalRoutes(kakao.data, now, { start, end }, etaFor);
    return Response.json(makeList(now, deadline, routes));
}