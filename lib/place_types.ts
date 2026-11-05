// 🤝 장소 검색 창구(GET /api/places?query=...)의 응답 약속이에요.
// 프론트(입력 화면)는 이 모양만 믿고 써요. 백엔드는 이 모양을 지켜서 돌려주면 돼요.
import { Point } from "./route_query";

export interface Place extends Point {
    id: string; // 카카오 장소 id (목록 key용)
    name: string; // "서울역 KTX"
    address: string; // "서울 용산구 한강대로 405"
}

// 200: { places: Place[] }  (결과 없으면 빈 배열)
// 실패: /api/routes와 같은 { error: { code, message } }
export interface PlacesResponse {
    places: Place[];
}
