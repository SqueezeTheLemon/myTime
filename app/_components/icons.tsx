// 🎨 목업에서 가져온 로고와 선 아이콘들이에요. 장식용은 aria-hidden.

export function Logo({ size = 36 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="제시간 로고">
            <rect width="128" height="128" rx="30" fill="#1F5FD1" />
            <path
                d="M75.3 91.3C69.2 98.8 64.0 104.0 64.0 104.0C64 104 34 74 34 54A30 30 0 0 1 94 54C94.0 65.7 83.8 80.8 75.3 91.3"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="9"
                pathLength={100}
                strokeDasharray="91.98 100"
            />
            <circle cx="85.2" cy="77.4" r="8" fill="#FFD27A" />
            <circle cx="64" cy="54" r="8" fill="#FFFFFF" />
        </svg>
    );
}

const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

export function LocateIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2.2" aria-hidden="true" {...stroke}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
    );
}

export function SearchIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2.2" aria-hidden="true" {...stroke}>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
        </svg>
    );
}

export function ChevronRight() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" strokeWidth="3" aria-hidden="true" {...stroke}>
            <path d="M9 5l7 7-7 7" />
        </svg>
    );
}

export function BackIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2.2" aria-hidden="true" {...stroke}>
            <path d="M15 5l-7 7 7 7" />
        </svg>
    );
}

export function CheckIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2.6" aria-hidden="true" {...stroke}>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
    );
}
