// GET /api/places?query=서울역
// 검색어 검사 → 카카오 로컬 호출 → Place[]로 변환 → { places } 응답
import { parsePlaceQuery } from "../../../lib/places/place_query";
import { fetchKakaoPlaces } from "../../../lib/kakao/local_client";
import { kakaoToPlaces } from "../../../lib/places/place_convert";
import type { PlacesResponse } from "../../../lib/places/place_types";

function fail(status: number, code: string, message: string) {
    return Response.json({error : {code, message}}, {status});
}

const RETRY_LATER = "잠시 후 다시 시도해 주세요";

export async function GET(request: Request) {


    const parsed = parsePlaceQuery(new URL(request.url).searchParams);
    if(!parsed.ok) return fail(400, "bad_request", parsed.message);
    const placeQuery = parsed.query;

    const kakao = await fetchKakaoPlaces(placeQuery);
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

    const places = kakaoToPlaces(kakao.data)
    return Response.json({places} satisfies PlacesResponse);

}
