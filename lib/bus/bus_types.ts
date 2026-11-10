// 서울 버스 도착정보 API 응답 설명서 (2026-11-10 실호출로 확인)
// GET http://ws.bus.go.kr/api/rest/arrive/getArrInfoByRouteAll?serviceKey=&busRouteId=&resultType=json
// 💡 노선 ID 하나로 그 노선의 "모든 정류장"에 다음 두 대가 언제 오는지 한꺼번에 와요 (402번은 110줄)
// 💡 지하철처럼 숫자도 전부 문자열이에요

export interface BusArrivalRow {
    busRouteId: string;
    rtNm: string; // 버스 번호 "402"
    stId: string; // 정류장 ID
    stNm: string; // 정류장 이름 "서울역버스환승센터" (카카오는 뒤에 "(5번승강장)(중)"이 더 붙어요)
    arsId: string; // 정류장 번호 (5자리)
    staOrd: string; // 노선에서 몇 번째 정류장인지 ("1"부터)
    mkTm: string; // 이 정보를 만든 시각 "2026-11-10 11:29:23.0" (한국 시간)
    exps1: string; // 첫 번째 버스가 이 정류장에 오기까지 초
    exps2: string; // 두 번째 버스
    arrmsg1: string; // "7분3초후[1번째 전]", "곧 도착", "출발대기", "운행종료"
    arrmsg2: string;
    isLast1: string; // "1"이면 막차
    isLast2: string;
}

export interface BusResponse {
    msgHeader: { headerCd: string; headerMsg: string; itemCount: number }; // headerCd "0" = 성공
    msgBody: { itemList: BusArrivalRow[] | null };
}
