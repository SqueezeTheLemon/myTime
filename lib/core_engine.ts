export const FAST_WALK_RATIO = 0.75;   // 빠른 걸음 = 보통 걸음 시간의 75% (최대 25% 단축)
export const BOARDING_BUFFER: Seconds = 60;   // 버스·지하철 탈 때 두는 1분 여유
export const MAX_OPTIONS = 3; // 경로 목록에 보여줄 최대 개수

// 시간은 엔진 안에서 전부 "초 단위 숫자"로 다룬다
// Date는 입구(API 응답)와 출구(화면 표시)에서만
export type Seconds = number; // 기간. "얼마나 걸리나" (예: 도보 180초)
export type EpochSeconds = number; // 시각. "언제인가" — 1970-01-01부터 지난 초

export type RouteSegment = WalkSegment | BusSegment | SubwaySegment;
export type TotalRoute = RouteSegment[];

export interface WalkSegment {
    type: "walk";
    time: Seconds; // 보통 걸음 기준 도보 시간
}

export interface BusSegment {
    type: "bus";
    time: Seconds; // 탑승 이동 시간
    busNumber: string; // 버스 번호
    eta: EpochSeconds; // 버스가 정류장에 도착하는 "시각" 
}

export interface SubwaySegment {
    type: "subway";
    time: Seconds; // 탑승 이동 시간
    lineNumber: string; // 호선 (예: "2호선")
    eta: EpochSeconds; // 열차가 역에 도착하는 "시각"
}

// 빨리 걸어야 할 도보 구간 
export interface WalkSpeedUp{
    segmentIndex : number; // 경로에서 몇번째 구간인지
    normalTime : Seconds; // 원래 걸리는 시간 
    timeLimit : Seconds; // 이 시간 내에 도착 필요 
}

export interface EvaluateResult{
    evaluate : "ahead" | "tight" | "delayed";
    allowTime : number;
}

export interface RouteOption{
    route : TotalRoute; // "도보 3분 → 740번 버스 11분 → 도보 2분"
    arrivalAt : EpochSeconds; // "2:29 도착"
    speedUps : WalkSpeedUp[]; // "도보 3분 → 2분 30초" (줄일 곳)
    evaluation : EvaluateResult; // "정시 도착 가능" + 여유
    

}

// 해당 루트의 성공/실패 여부를 확인. 
export type ArrivalEstimate = 
    | {
        ok : true // limit 시간 내 도착 가능
        arrivalAt : EpochSeconds; // 예상 도착 시각
        slack : Seconds; // 데드라인 - 도착 시각
        speedUps : WalkSpeedUp[] // 빨리 걸어야 하는 구간들 
    }
    | {
        ok : false;
        missedSegmentIndex : number; // 빠른 걸음으로도 못 타는 차가 몇번쨰 구간인가? 
}

export type FinalResult=
    |{
        ok : true;
        options : RouteOption[]; // 도착 빠른 순, 최대 MAX_OPTIONS 개
    }
    |{
        ok:false; // 제시간 도착 불가 화면
        fastestArrivalAt : EpochSeconds | null; // 가장 빨리 도착하는 시각 
        lateBy: Seconds | null; // 그때 데드라인보다 몇초 늦는지 

    }



// 빠른 걸음으로 걸었을 때 걸리는 최소 시간 (올림으로 계산)
export function fastLimit(walkTime: Seconds): Seconds {
    return Math.ceil(walkTime * FAST_WALK_RATIO);
}

// 지금부터 어떤 시각까지 남은 시간 (이미 지났으면 음수)
export function secondsUntil(now: EpochSeconds, target: EpochSeconds): Seconds {
    return target - now;
}

// 차를 놓치지 않으려면 정류장에 도착해야 하는 마지막 시각 (차 도착 1분 전)
export function boardingDeadline(vehicleEta: EpochSeconds): EpochSeconds {
    return vehicleEta - BOARDING_BUFFER;
}


export function estimateArrival(
    now : EpochSeconds,
    deadline : EpochSeconds,
    route: TotalRoute,
): ArrivalEstimate {
    let clock = now; // 경로를 따라가며 앞으로 가는 시계
    const speedUps: WalkSpeedUp[] = [] // 빨리 걸어야 하는 구간

    for (let i = 0 ; i< route.length; i++){
        const seg = route[i];

        if(seg.type === 'walk'){
            const next = route[i+1]; // 다음에 오는 버스/지하철의 도착 시간 확인
            const isLast = next === undefined;

            let target : EpochSeconds | null;

            if (isLast) target = deadline; // 도착지에 도달하기까지 마지막 도보
            else if (next.type === 'walk') target= null; // 다음도 도보 (드문 경우)
            else target = boardingDeadline(next.eta); // 다음이 버스 또는 지하철일때, 그 도착 시각(+여유시간)을 받아옴 
            
            // 1. 보통 걸음으로 충분한 경우
            if (target===null || clock + seg.time <= target){
                clock += seg.time;
                continue;
            }
            
            // 2. 빠른 걸음으로도 차를 못 타면 이 경로는 실패 처리
            if (!isLast && clock + fastLimit(seg.time) > target) {
                return {ok:false, missedSegmentIndex: i+1};
            }

            // 3. 빨리 걸으면 다음 단계에 도달 가능
            const timeLimit = Math.max(target - clock, fastLimit(seg.time));
            speedUps.push({ segmentIndex: i, normalTime: seg.time, timeLimit });
            clock += timeLimit;
        } 
        else {
            // 도보 없이 차→차로 바로 갈아타는 경우
            if (clock > boardingDeadline(seg.eta)) {
                return { ok: false, missedSegmentIndex: i };
            }
            // 일찍 왔으면 기다렸다가(= eta로 점프) 타고 간다. 
            clock = seg.eta + seg.time;
        }
    }

    return { ok: true, arrivalAt: clock, slack: deadline - clock, speedUps };
}
    

export function evaluateArrival(arrive : ArrivalEstimate): EvaluateResult | null{
    const MAX_LATE = 300;
    const MAX_AHEAD = 60;

    if(arrive.ok){
        let allowTime = arrive.slack; 

        if(allowTime >= MAX_AHEAD)  return {evaluate : "ahead", allowTime : allowTime};
        else if (0<=allowTime && allowTime<MAX_AHEAD) return {evaluate: "tight", allowTime:allowTime}; 
        else if (allowTime >= -MAX_LATE) return {evaluate: "delayed", allowTime:allowTime}; // 5분 이내 지각까지만
        else return null; // null = 목록에서 제외 (차를 못 타거나, 5분 넘게 늦는 경로)
    }
    else{
        return null;
    }

}

export function makeList(now: EpochSeconds, deadline: EpochSeconds, totalRoutes : TotalRoute[]): FinalResult{
    const candidates :RouteOption[] = [];
    let fastestArrivalAt : EpochSeconds | null= null;


    for (const troute of totalRoutes){
        const estimate = estimateArrival(now, deadline, troute)
        
        if(!estimate.ok) continue; // 차를 못 타면 바로 stop, 다음 경로로 넘어간다. 
        // 가장 빠른 도착 기억해두기 (도착 불가 화면에서 사용 )
        if(fastestArrivalAt == null || estimate.arrivalAt <fastestArrivalAt) fastestArrivalAt = estimate.arrivalAt;

        const evaluation = evaluateArrival(estimate);
        if(evaluation === null) continue;
        candidates.push({route: troute, arrivalAt:estimate.arrivalAt, speedUps:estimate.speedUps, evaluation});
    }

    if(candidates.length === 0){
        return{
            ok:false,
            fastestArrivalAt,
            lateBy : fastestArrivalAt === null ? null : fastestArrivalAt-deadline
        }
    }

    candidates.sort((a, b) => a.arrivalAt - b.arrivalAt);
    return { ok: true, options: candidates.slice(0, MAX_OPTIONS) };
}