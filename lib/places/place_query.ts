// /api/places 로 들어온 검색어(query)를 검사하는 순수 함수

export const MAX_QUERY_LENGTH = 30; // 검색어 최대 길이

export type PlaceQueryResult =
    | { ok: true; query: string } 
    | { ok: false; message: string };

export function parsePlaceQuery(params: URLSearchParams): PlaceQueryResult {

    const placeQuery = params.get("query")?.trim();

    if(placeQuery == null || placeQuery == "") 
        return { ok: false, message: "검색어를 입력해 주세요." };
    if(placeQuery.length > MAX_QUERY_LENGTH)  
        return { ok: false, message: `검색어를 ${MAX_QUERY_LENGTH}자 안으로 줄여 주세요.` };

    return {ok:true, query : placeQuery};
}
