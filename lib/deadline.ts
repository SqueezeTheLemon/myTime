// ⏰ 입력 화면의 "도착 데드라인"을 다루는 순수 함수들이에요.
// 💡 Date는 브라우저의 현지 시각(서울) 기준으로 다뤄요. 화면 입력값은 "HH:MM" 문자열이에요.

const MINUTE_MS = 60_000;

// "HH:MM" → 오늘 그 시각. 이미 지났거나 지금이면 내일로 넘겨요 (밤 11시 50분에 "00:20" 입력 같은 경우).
export function deadlineFromTime(now: Date, hhmm: string): Date | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;

    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    return target;
}

// "15분 뒤" 칩: 분 단위로 올림해요 (2:12:40 + 15분 → 2:28). 내림하면 15분보다 짧아지거든요.
export function minutesLater(now: Date, minutes: number): Date {
    const raw = now.getTime() + minutes * MINUTE_MS;
    return new Date(Math.ceil(raw / MINUTE_MS) * MINUTE_MS);
}

// "정각으로" 칩: 지금 이후 가장 가까운 정각 (2:12 → 3:00, 2:00 → 3:00)
export function nextOClock(now: Date): Date {
    const target = new Date(now);
    target.setHours(now.getHours() + 1, 0, 0, 0);
    return target;
}

// Date → <input type="time">에 넣을 "HH:MM"
export function toTimeValue(date: Date): string {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

// 데드라인이 오늘인지 내일인지 (화면 문구용)
export function dayLabel(now: Date, target: Date): "오늘" | "내일" {
    return now.toDateString() === target.toDateString() ? "오늘" : "내일";
}
