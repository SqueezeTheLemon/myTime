// 카카오 응답 -> 엔진이 이해할 수 있는 Total Route로 바꾸기
import { BOARDING_BUFFER, EpochSeconds, RouteSegment, TotalRoute } from "../engine/core_engine";
import { KakaoResponse, KakaoRoute, KakaoStep } from "./transit_types";

// 일단, 정류장에 도착하고 딱 탑승 여유(boarding buffer)만큼 지나면 차가 온다고 가정 - 차를 놓치는 경우의 수는 나중에 생각 
export function placeholderEta(arrivalAtStop : EpochSeconds): EpochSeconds{
    return arrivalAtStop + BOARDING_BUFFER;
}

// step 하나를 core engine 구간 하나로 변환 
function toSegment(step : KakaoStep, clock:EpochSeconds): RouteSegment | null{
    const p = step.properties;

    switch(p.type){
        case "WALKING" : return {type : "walk", time : p.time};
        case "BUS":
        case "SUBWAY":{
            // vehicles는 우선 리스트로 와도 하나만 탄다. 
            const first = p.vehicles?.[0];
            if(!first) return null; // 탈 차 정보가 없으면 판정 x

            const eta = placeholderEta(clock);
            return p.type === "BUS"
            ? {type : "bus", time: p.time, busNumber: first.name, eta}
            : { type: "subway", time: p.time, lineNumber: first.name, eta };

        }
        default: return null // 카카오가 세 교통 수단 외에 다른 type을 가져다 두어도 터지지 않음
    }
}

// 카카오 경로 1개 -> TotalRoute로 변환
export function kakaoRouteToTotalRoute(route : KakaoRoute, now : EpochSeconds): TotalRoute | null{
    const segments : TotalRoute = [];
    let clock = now; // 엔진처럼 시계를 앞으로 굴리며 각 차의 eta를 구한다. 

    for (const step of route.steps){
        const seg = toSegment(step, clock);
        if(seg === null) return null;

        clock = seg.type === "walk" ? clock + seg.time : seg.eta + seg.time;
        segments.push(seg);
    }

    return segments.length > 0 ? segments : null; // 빈 경로는 의미가 없음
}

// 응답 전체 -> 엔진에 넣을 TotalRoute 목록
export function kakaoToTotalRoutes(res : KakaoResponse, now:EpochSeconds): TotalRoute[]{
    if(res.status!=="OK") return [];
    const result : TotalRoute[] = [];

    for(const route of res.routes){
        const total = kakaoRouteToTotalRoute(route, now);
        if(total !== null) result.push(total);
    }
    return result;
}
