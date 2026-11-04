// kakao의 응답 결과를 typescript에게 알려주는 설명서 작성

export interface KakaoVehicle{
    name : string;
    type : string;
}

export interface KakaoStop{
    name : string;
}

export interface KakaoPath{
    points : number[][];
}


export interface KakaoStepProperties{
    guidance : string;
    type : "BUS" | "SUBWAY" | "WALKING";
    distance : number;
    time : number;
    stops : KakaoStop[];
    vehicles : KakaoVehicle[];
}

export interface KakaoStep{
    properties : KakaoStepProperties;
    path : KakaoPath;
}

export interface KakaoRouteProperties{
    type : "BUS" | "SUBWAY" | "BUS_AND_SUBWAY";
    totalDistance : number; // 미터
    totalTime : number; // 초 (대기 시간 추정치까지 섞인 값)
    transfers : number; // 환승 횟수
}

export interface KakaoRoute{
    properties : KakaoRouteProperties;
    steps : KakaoStep[];
}

// 최상단 properties : 경로 개수와 같은 요약 정보
export interface KakaoSummary{
    total : number; // 전체 경로 수
    bus : number; // 버스 경로 수
    subway : number ;
    busAndSubway : number;
    landingURL : string; // 카카오맵 길찾기 화면 링크
}

export type KakaoResponse = KakaoSuccessResponse | KakaoFailureResponse;

export type KakaoStatus =
  | "OK"
  | "STARTNODES_NULL"
  | "ENDNODES_NULL"
  | "EQUAL_POINTS"
  | "INVALID_REQUEST"
  | "NO_RESULTS";

interface KakaoSuccessResponse{
    status : "OK";
    properties : KakaoSummary;
    routes:KakaoRoute[]; // status가 ok일 때만 응답에 포함됨
}

interface KakaoFailureResponse{
    status : Exclude<KakaoStatus, "OK">;
    properties : KakaoSummary;
    routes? : never; // 실패하면 routes 자체가 안 와요
}
