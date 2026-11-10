// 지하철 실시간 응답 → "이 역에 이 열차가 언제 오나" (순수 함수만, 네트워크 없음)
//
// 큰 흐름
//   응답 줄(SubwayArrivalRow) ──toArrival──▶ TrainArrival { 노선, 방면, 종착, 급행, eta }
//   카카오 지하철 구간 + 가장 빨리 역에 닿는 시각 ──pickSubwayEta──▶ 탈 수 있는 첫 열차의 eta
import { BOARDING_BUFFER, EpochSeconds, Seconds } from "../engine/core_engine";
import { SubwayArrivalRow } from "./subway_types";

// 카카오 노선 이름 → 서울 API subwayId
// 💡 실측으로 본 이름: "1호선"~"9호선", "신분당선". 나머지는 카카오 표기를 추정한 거라, 안 맞으면 그냥 실시간 없이(placeholder) 가요
export const SUBWAY_LINE_IDS: Record<string, string> = {
    "1호선": "1001", "2호선": "1002", "3호선": "1003", "4호선": "1004", "5호선": "1005",
    "6호선": "1006", "7호선": "1007", "8호선": "1008", "9호선": "1009",
    "중앙선": "1061", "경의중앙선": "1063", "공항철도": "1065", "경춘선": "1067",
    "수인분당선": "1075", "신분당선": "1077", "경강선": "1081", "우이신설선": "1092",
    "서해선": "1093", "신림선": "1094", "GTX-A": "1032",
};

// 📏 정거장 수만 알 때 쓰는 가정값: 한 정거장 ≈ 100초 (이동 + 정차)
// 💡 일부러 조금 짧게 잡았어요. 열차가 "실제보다 일찍 온다"고 믿는 쪽이 놓칠 위험이 적거든요
export const SECONDS_PER_STATION: Seconds = 100;
// 받은 지 5분 넘은 정보는 열차 위치가 이미 바뀌었을 테니 버려요
export const STALE_LIMIT: Seconds = 300;

// arvlCd별로 "이 역까지 남은 초" 어림값 (barvlDt가 0일 때만 써요)
const SECONDS_BY_CODE: Record<string, Seconds> = {
    "0": 30, // 진입: 곧 들어와요
    "1": 0, // 도착: 지금 서 있어요
    "4": 180, // 전역 진입
    "5": 150, // 전역 도착
    "3": 120, // 전역 출발
};

export interface TrainArrival {
    lineId: string;
    heading: string; // 방면 = 이 열차가 다음에 설 역 (정규화된 이름)
    terminus: string; // 종착역 (정규화된 이름)
    express: boolean;
    eta: EpochSeconds;
}

// "서울역" → "서울", "교대(법원.검찰청)" → "교대", "신촌(경의중앙선)" → "신촌"
// 💡 카카오와 서울 API의 역 이름 표기가 달라서, 비교 전에 둘 다 이 모양으로 맞춰요
export function normalizeStation(name: string): string {
    const noParen = name.replace(/\(.*?\)/g, "").trim();
    // "역삼"처럼 '역'으로 시작하는 건 그대로, 끝에 붙은 '역'만 떼요 (한 글자 역 이름은 보호)
    return noParen.length > 2 && noParen.endsWith("역") ? noParen.slice(0, -1) : noParen;
}

// "2026-11-09 16:45:35" (한국 시간) → EpochSeconds. 모양이 이상하면 null
export function parseKst(text: string): EpochSeconds | null {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text);
    if (!m) return null;
    const [, y, mo, d, h, mi, s] = m.map(Number);
    return Date.UTC(y, mo - 1, d, h - 9, mi, s) / 1000; // KST = UTC+9
}

// 남은 초를 알아내요: barvlDt → 메시지의 "N분 M초 후" → "[N]번째 전역" → arvlCd 순서로 믿어요
// 이미 떠난 열차("출발")나 알 수 없는 상태면 null
export function secondsToStation(row: SubwayArrivalRow): Seconds | null {
    const barvl = Number(row.barvlDt);
    if (Number.isFinite(barvl) && barvl > 0) return barvl;

    if (row.arvlCd === "2") return null; // 이 역을 이미 출발

    const minSec = /(\d+)분(?:\s*(\d+)초)?\s*후/.exec(row.arvlMsg2);
    if (minSec) return Number(minSec[1]) * 60 + Number(minSec[2] ?? 0);

    const stations = /\[(\d+)\]번째 전역/.exec(row.arvlMsg2);
    if (stations) return Number(stations[1]) * SECONDS_PER_STATION;

    return SECONDS_BY_CODE[row.arvlCd] ?? null;
}

// 응답 한 줄 → TrainArrival (못 믿을 줄이면 null)
export function toArrival(row: SubwayArrivalRow, now: EpochSeconds): TrainArrival | null {
    const received = parseKst(row.recptnDt);
    if (received === null) return null;
    if (now - received > STALE_LIMIT) return null; // 너무 오래된 정보

    const remain = secondsToStation(row);
    if (remain === null) return null;

    // ⚠️ 수신 시각이 "미래"로 오는 경우가 있어요(신분당선 실측 +5분) → 그땐 지금을 기준으로
    const base = Math.min(received, now);

    // "진접행 - 회현방면 (급행)" → 종착 "진접", 방면 "회현", 급행 true
    const m = /^(.+?)행\s*-\s*(.+?)방면/.exec(row.trainLineNm);
    if (!m) return null;

    return {
        lineId: row.subwayId,
        terminus: normalizeStation(m[1]),
        heading: normalizeStation(m[2]),
        express: row.trainLineNm.includes("급행"),
        eta: base + remain,
    };
}

// 응답 전체 → TrainArrival 목록
// 💡 같은 열차가 두 줄로 올 때가 있어서(btrainNo 같음), 초 값이 있는 줄 → 더 최근 줄 순으로 하나만 남겨요
export function toArrivals(rows: SubwayArrivalRow[], now: EpochSeconds): TrainArrival[] {
    const best = new Map<string, SubwayArrivalRow>();
    const score = (r: SubwayArrivalRow) => (Number(r.barvlDt) > 0 ? 1e10 : 0) + (parseKst(r.recptnDt) ?? 0);
    for (const r of rows) {
        const key = `${r.subwayId}-${r.updnLine}-${r.btrainNo}`;
        const prev = best.get(key);
        if (!prev || score(r) > score(prev)) best.set(key, r);
    }

    const result: TrainArrival[] = [];
    for (const r of best.values()) {
        const a = toArrival(r, now);
        if (a) result.push(a);
    }
    return result.sort((a, b) => a.eta - b.eta);
}

// 카카오 지하철 구간에 맞는 열차 중, 시간 안에 탈 수 있는 첫 열차의 eta
//   lineName: 카카오 vehicles[].name ("4호선")
//   stops:    카카오 stops 이름 목록 (첫 번째 = 타는 역, 두 번째 = 다음 역 → 방향 판별)
//   earliest: 빠른 걸음으로 이 역에 닿을 수 있는 가장 이른 시각
// 맞는 열차가 없으면 null → 부르는 쪽에서 placeholder로 대신해요
export function pickSubwayEta(
    arrivals: TrainArrival[],
    lineName: string,
    stops: string[],
    earliest: EpochSeconds,
): EpochSeconds | null {
    const lineId = SUBWAY_LINE_IDS[lineName];
    if (!lineId || stops.length < 2) return null;

    const route = stops.map(normalizeStation);
    const next = route[1];
    // 내릴 역 전에 끝나는 열차를 거르려고: 탄 역 ~ 내릴 역 직전까지
    const beforeGetOff = new Set(route.slice(0, -1));

    for (const a of arrivals) {
        if (a.lineId !== lineId) continue;
        if (a.heading !== next) continue; // 반대 방향
        // 급행은 내릴 역에 안 설 수도 있어서 일단 빼요 (놓치는 쪽이 아니라 늦게 잡는 쪽이라 안전)
        if (a.express) continue;
        if (beforeGetOff.has(a.terminus)) continue; // 중간에 끝나는 열차
        if (a.eta - BOARDING_BUFFER >= earliest) return a.eta; // 목록이 eta 순이라 처음 맞는 게 첫 열차
    }
    return null;
}
