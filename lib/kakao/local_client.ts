// 카카오 로컬 키워드 검색을 실제로 부르고, 실패 이유를 분류한다. (서버 전용)
// 💡 kakao/transit_client.ts(fetchKakaoTransit)와 거의 같아요. 다른 점은 URL과 파라미터뿐!
//    복사할지, 공통 부분을 뽑을지는 직접 골라보세요. (뽑는다면 kakao/transit_client.ts도 같이 고쳐야 해요)
import { KakaoPlaceResponse } from "./local_types";
import { SEOUL } from "../seoul";

const KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const TIMEOUT_MS = 5000;

// TODO: 한 번에 몇 개까지 받을지 (문서에서 size 범위를 확인하세요)
const RESULT_SIZE = 15;

export type KakaoPlaceFetchResult =
    | { ok: true; data: KakaoPlaceResponse }
    | { ok: false; reason: "no_key" | "auth" | "quota" | "upstream" };

export async function fetchKakaoPlaces(query: string): Promise<KakaoPlaceFetchResult> {

    const key = process.env.KAKAO_REST_API_KEY;
    if(!key) return {ok:false, reason:"no_key"};

    const params = new URLSearchParams({
        query,
        size : String(RESULT_SIZE),
        rect : `${SEOUL.minX},${SEOUL.minY},${SEOUL.maxX},${SEOUL.maxY}`,
    });

    let res : Response;
    try{
        res = await fetch(`${KAKAO_LOCAL_URL}?${params}`,{
            headers:{Authorization : `KakaoAK ${key}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    }catch{
        return {ok:false, reason:"upstream"};
    }
    
    // HTTP 상태로 분류
    if(res.status === 401 || res.status === 403) return {ok:false, reason:"auth"};
    if(res.status === 429)return { ok: false, reason: "quota" };
    if (!res.ok) return { ok: false, reason: "upstream" };

    return { ok: true, data: (await res.json()) as KakaoPlaceResponse };
}
