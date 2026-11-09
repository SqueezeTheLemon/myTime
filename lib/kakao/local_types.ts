// 카카오 로컬 "키워드로 장소 검색" 응답 타입 (우리가 쓰는 필드만)
// 문서: https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
//
// 💡 TODO(1단계): curl로 실제 응답을 받아보고, 아래 필드가 정말 그 이름·타입으로 오는지 확인하세요.
//    특히 x, y가 number가 아니라 string이라는 점!

export interface KakaoPlaceDocument {
    id: string;
    place_name: string; // "서울역 KTX"
    address_name: string; // 지번 주소
    road_address_name: string; // 도로명 주소 (없으면 빈 문자열 "")
    x: string; // 경도 
    y: string; // 위도
}

export interface KakaoPlaceResponse {
    documents: KakaoPlaceDocument[];

}
