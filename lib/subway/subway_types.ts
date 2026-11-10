// 서울 지하철 실시간 도착정보 API 응답 설명서 (2026-11-09 실호출로 확인)
// GET http://swopenapi.seoul.go.kr/api/subway/{KEY}/json/realtimeStationArrival/{시작}/{끝}/{역명}
// 💡 숫자처럼 보이는 값도 전부 "문자열"로 와요. 숫자로 바꾸는 건 subway_arrivals.ts의 일이에요.

export interface SubwayArrivalRow {
    subwayId: string; // 노선 ID ("1004" = 4호선)
    updnLine: string; // "상행" | "하행" (2호선은 "내선" | "외선")
    trainLineNm: string; // "진접행 - 회현방면", 급행이면 끝에 " (급행)"
    statnNm: string; // 조회한 역 이름 ("서울")
    barvlDt: string; // 도착까지 남은 초. ⚠️ 1호선·경의중앙·공항철도·신분당은 대부분 "0"
    recptnDt: string; // 이 정보를 받은 시각 "YYYY-MM-DD HH:mm:ss" (한국 시간)
    arvlCd: string; // 0 진입, 1 도착, 2 출발, 3 전역출발, 4 전역진입, 5 전역도착, 99 운행중
    arvlMsg2: string; // "5분 30초 후 (신용산)", "[5]번째 전역 (용산)", "서울 출발"
    arvlMsg3: string; // 열차가 지금 있는 역
    btrainNo: string; // 열차 번호 (같은 열차가 두 줄로 올 때가 있어요)
    lstcarAt: string; // "1"이면 막차
}

// 성공: errorMessage 안에 code "INFO-000"
export interface SubwaySuccessResponse {
    errorMessage: { status: number; code: string; message: string; total: number };
    realtimeArrivalList: SubwayArrivalRow[];
}

// 실패: errorMessage 없이 바깥에 바로 code가 와요 (HTTP 상태는 200이어도요!)
//   INFO-100 인증키가 유효하지 않음, INFO-200 해당 데이터 없음 (실측)
export interface SubwayFailureResponse {
    status: number;
    code: string;
    message: string;
    realtimeArrivalList?: never;
}

export type SubwayResponse = SubwaySuccessResponse | SubwayFailureResponse;
