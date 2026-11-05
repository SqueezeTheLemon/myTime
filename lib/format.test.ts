import { describe, expect, it } from "vitest";
import {
    formatAllowance,
    formatClock,
    formatDuration,
    formatLimit,
    formatRemaining,
    segmentName,
    shortClock,
} from "./format";

const epoch = (h: number, m: number) => new Date(2026, 10, 5, h, m).getTime() / 1000;

describe("시각", () => {
    it("오전/오후 12시간제", () => {
        expect(formatClock(epoch(14, 30))).toBe("오후 2:30");
        expect(formatClock(epoch(9, 5))).toBe("오전 9:05");
        expect(formatClock(epoch(0, 10))).toBe("오전 12:10");
        expect(formatClock(epoch(12, 0))).toBe("오후 12:00");
    });

    it("짧은 시각", () => {
        expect(shortClock(epoch(14, 29))).toBe("2:29");
    });
});

describe("formatDuration", () => {
    it("반올림한 분, 최소 1분", () => {
        expect(formatDuration(180)).toBe("3분");
        expect(formatDuration(150)).toBe("3분");
        expect(formatDuration(20)).toBe("1분");
    });

    it("한 시간 넘으면 시간 단위", () => {
        expect(formatDuration(3900)).toBe("1시간 5분");
        expect(formatDuration(3600)).toBe("1시간");
    });
});

describe("formatLimit", () => {
    it("30초 단위로 내림", () => {
        expect(formatLimit(120)).toBe("2분");
        expect(formatLimit(150)).toBe("2분 30초");
        expect(formatLimit(179)).toBe("2분 30초");
        expect(formatLimit(40)).toBe("30초");
    });
});

describe("formatRemaining", () => {
    it("남은 분", () => {
        expect(formatRemaining(18 * 60 + 40)).toBe("18분 남음");
        expect(formatRemaining(30)).toBe("1분 안 남음");
        expect(formatRemaining(0)).toBe("마감 시각이 지났어요");
    });
});

describe("formatAllowance", () => {
    it("상태별 문구", () => {
        expect(formatAllowance({ evaluate: "ahead", allowTime: 190 })).toBe("여유 3분");
        expect(formatAllowance({ evaluate: "tight", allowTime: 30 })).toBe("여유 1분 미만");
        expect(formatAllowance({ evaluate: "delayed", allowTime: -100 })).toBe("2분 늦음");
        expect(formatAllowance({ evaluate: "delayed", allowTime: -10 })).toBe("1분 늦음");
    });
});

describe("segmentName", () => {
    it("수단별 이름", () => {
        expect(segmentName({ type: "walk", time: 60 })).toBe("도보");
        expect(segmentName({ type: "bus", time: 60, busNumber: "740", eta: 0 })).toBe("740번 버스");
        expect(segmentName({ type: "subway", time: 60, lineNumber: "4호선", eta: 0 })).toBe("지하철 4호선");
        expect(segmentName({ type: "subway", time: 60, lineNumber: "신분당선", eta: 0 })).toBe("신분당선");
    });
});
