import { describe, it, expect } from "vitest";
import { normalizeStation, parseKst, pickSubway, pickSubwayEta, toArrival, toArrivals, STALE_LIMIT } from "./subway_arrivals";
import { gangnamRows, SAMPLE_NOW, seoulRows } from "./fixtures/subway_sample";
import { BOARDING_BUFFER } from "../engine/core_engine";

// 🕑 샘플을 받은 시각으로 "지금"을 고정해요
const NOW = SAMPLE_NOW;

describe("이름·시각 맞추기", () => {
    it("카카오와 서울 API의 역 이름 표기를 같은 모양으로 맞춘다", () => {
        expect(normalizeStation("서울역")).toBe("서울");
        expect(normalizeStation("교대(법원.검찰청)")).toBe("교대");
        expect(normalizeStation("역삼")).toBe("역삼"); // 앞의 '역'은 그대로
    });

    it("한국 시간 문자열을 epoch 초로 바꾼다 (9시간 차이 주의)", () => {
        expect(parseKst("2026-11-09 16:45:35")).toBe(NOW);
        expect(parseKst("이상한 값")).toBeNull();
    });
});

describe("toArrival — 응답 한 줄의 도착 시각", () => {
    const base = seoulRows[2]; // 4호선 진접행, barvlDt 330

    it("초 값이 있으면 수신 시각 + 초", () => {
        expect(toArrival(base, NOW)?.eta).toBe(NOW + 330);
    });

    it("초 값이 0이면 '[N]번째 전역'으로 어림한다", () => {
        const row = { ...base, barvlDt: "0", arvlMsg2: "[3]번째 전역 (용산)" };
        expect(toArrival(row, NOW)?.eta).toBe(NOW + 300);
    });

    it("이미 출발한 열차는 버린다", () => {
        expect(toArrival(seoulRows[0], NOW)).toBeNull(); // "서울 출발"
    });

    it("너무 오래된 정보는 버린다", () => {
        expect(toArrival(base, NOW + STALE_LIMIT + 1)).toBeNull();
    });

    it("수신 시각이 미래면 지금을 기준으로 잡는다", () => {
        const row = { ...base, recptnDt: "2026-11-09 16:50:35" }; // 5분 미래
        expect(toArrival(row, NOW)?.eta).toBe(NOW + 330);
    });
});

describe("toArrivals", () => {
    it("같은 열차가 두 줄이면 초 값이 있는 줄만 남긴다", () => {
        const incheon = toArrivals(seoulRows, NOW).filter((a) => a.terminus === "인천");
        // 0145(5분 후)와 0147([10]번째 전역) 두 대만 남아요
        expect(incheon.map((a) => a.eta)).toEqual([NOW + 300, parseKst("2026-11-09 16:43:00")! + 1000]);
    });
});

describe("pickSubwayEta — 탈 수 있는 첫 열차 고르기", () => {
    const arrivals = toArrivals(seoulRows, NOW);
    const toSookmyung = ["서울역", "숙대입구(서울시교육청)", "삼각지(전쟁기념관)", "신용산"];

    it("방향(다음 역)이 맞는 열차 중 가장 빠른 것", () => {
        // 4호선 숙대입구 방면: 오이도행 +120, 사당행 +540
        expect(pickSubwayEta(arrivals, "4호선", toSookmyung, NOW)).toBe(NOW + 120);
    });

    it("탑승 여유 1분 안에 못 닿으면 다음 열차", () => {
        expect(pickSubwayEta(arrivals, "4호선", toSookmyung, NOW + 120 - BOARDING_BUFFER + 1)).toBe(NOW + 540);
    });

    it("내릴 역보다 먼저 끝나는 열차는 건너뛴다", () => {
        // 사당까지 가는 경로라면 사당행은 OK, 하지만 사당을 지나 더 가면 사당행은 못 타요
        const beyondSadang = ["서울역", "숙대입구", "사당", "남태령"];
        expect(pickSubwayEta(arrivals, "4호선", beyondSadang, NOW + 100)).toBeNull();
    });

    it("급행은 고르지 않는다", () => {
        const toNamyeong = ["서울역", "남영", "용산"];
        // 신창행 급행은 2분 전 "진입"이라 NOW-119쯤 와요. 일찍 닿을 수 있다고 해도 급행이라 건너뛰어요
        expect(pickSubwayEta(arrivals, "1호선", toNamyeong, NOW - 200)).toBe(NOW + 150); // 서동탄행(일반)
    });

    it("반대 방향만 있거나 모르는 노선이면 null (→ placeholder)", () => {
        expect(pickSubwayEta(arrivals, "4호선", ["서울역", "명동"], NOW)).toBeNull();
        expect(pickSubwayEta(arrivals, "없는선", toSookmyung, NOW)).toBeNull();
    });

    it("2호선 내선/외선도 방면으로 구분한다", () => {
        const gangnam = toArrivals(gangnamRows, NOW);
        const recv = parseKst("2026-11-09 16:45:30")!;
        expect(pickSubwayEta(gangnam, "2호선", ["강남", "역삼", "선릉"], NOW)).toBe(recv + 90);
        expect(pickSubwayEta(gangnam, "2호선", ["강남", "교대(법원.검찰청)"], NOW)).toBe(recv + 140);
    });
});

describe("pickSubway — 실시간 → 배차 어림 → placeholder", () => {
    const arrivals = toArrivals(seoulRows, NOW);
    const toSookmyung = ["서울역", "숙대입구(서울시교육청)", "삼각지(전쟁기념관)"];

    it("목록 안이면 빠른 걸음(earliest) 기준 실시간 열차", () => {
        expect(pickSubway(arrivals, "4호선", toSookmyung, { clock: NOW + 100, earliest: NOW + 60 })).toEqual({ eta: NOW + 120 });
    });

    it("목록 범위 밖에 닿으면 보통 걸음(clock) + 배차/2로 어림", () => {
        const at = { clock: NOW + 1200, earliest: NOW + 1100 };
        expect(pickSubway(arrivals, "4호선", toSookmyung, at)).toEqual({ eta: NOW + 1200 + 180, estimated: true }); // 4호선 6분 배차
    });

    it("이 방향 열차가 목록에 없으면 null (→ placeholder)", () => {
        expect(pickSubway(arrivals, "4호선", ["서울역", "명동"], { clock: NOW + 1200, earliest: NOW + 1200 })).toBeNull();
    });
});
