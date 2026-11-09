// 카카오 장소 응답 → 화면이 쓰는 Place[] 로 바꾸는 함수

import { KakaoPlaceDocument, KakaoPlaceResponse } from "../kakao/local_types";
import { Place } from "./place_types";
import { toNumber, Point } from "../routes/route_query";
import { inSeoul } from "../seoul";

// 문서 1개 → Place. 쓸 수 없는 문서면 null
export function toPlace(doc: KakaoPlaceDocument): Place | null {
    const px = toNumber(doc.x);
    const py = toNumber(doc.y);
    if (px === null || py === null) return null;
    
    const point: Point = { x: px, y: py };
    // 서울 밖이면 제외 
    if (!inSeoul(point)) return null;

    // 3) 도로명 주소가 있으면 그걸, 빈 문자열이면 지번 주소
    const address = doc.road_address_name || doc.address_name;

    return { id: doc.id, name: doc.place_name, address, ...point };
}


export function kakaoToPlaces(res: KakaoPlaceResponse): Place[] {
    const realPlaces: Place[] = [];

    for (const document of res.documents) {
        const place = toPlace(document);
        if (place !== null) realPlaces.push(place);
    }
    return realPlaces;
}
