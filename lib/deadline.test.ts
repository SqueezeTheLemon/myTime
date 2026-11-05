import { describe, expect, it } from "vitest";
import { dayLabel, deadlineFromTime, minutesLater, nextOClock, toTimeValue } from "./deadline";

// 💡 new Date(년, 월-1, 일, 시, 분)은 현지 시각이라 테스트가 시간대에 안 흔들려요.
const at = (h: number, m: number, s = 0) => new Date(2026, 10, 5, h, m, s);

describe("deadlineFromTime", () => {
    it("아직 안 지난 시각이면 오늘", () => {
        expect(deadlineFromTime(at(14, 12), "14:30")).toEqual(at(14, 30));
    });

    it("이미 지난 시각이면 내일", () => {
        expect(deadlineFromTime(at(23, 50), "00:20")).toEqual(new Date(2026, 10, 6, 0, 20));
    });

    it("지금과 같은 분이면 내일 (0분 남은 데드라인은 의미가 없어요)", () => {
        expect(deadlineFromTime(at(14, 30), "14:30")).toEqual(new Date(2026, 10, 6, 14, 30));
    });

    it("형식이 틀리면 null", () => {
        expect(deadlineFromTime(at(14, 12), "")).toBeNull();
        expect(deadlineFromTime(at(14, 12), "25:00")).toBeNull();
        expect(deadlineFromTime(at(14, 12), "2:3")).toBeNull();
    });
});

describe("minutesLater", () => {
    it("분 단위로 올림", () => {
        expect(minutesLater(at(14, 12, 40), 15)).toEqual(at(14, 28));
    });

    it("딱 맞아떨어지면 그대로", () => {
        expect(minutesLater(at(14, 12), 30)).toEqual(at(14, 42));
    });
});

describe("nextOClock", () => {
    it("다음 정각", () => {
        expect(nextOClock(at(14, 12))).toEqual(at(15, 0));
        expect(nextOClock(at(14, 0))).toEqual(at(15, 0));
    });

    it("자정을 넘기면 다음 날 0시", () => {
        expect(nextOClock(at(23, 40))).toEqual(new Date(2026, 10, 6, 0, 0));
    });
});

describe("toTimeValue / dayLabel", () => {
    it("두 자리로 채워요", () => {
        expect(toTimeValue(at(9, 5))).toBe("09:05");
    });

    it("오늘/내일", () => {
        expect(dayLabel(at(23, 50), at(23, 55))).toBe("오늘");
        expect(dayLabel(at(23, 50), new Date(2026, 10, 6, 0, 20))).toBe("내일");
    });
});
