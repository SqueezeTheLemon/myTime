// 🗺️ 서울 범위 (경로 검색·장소 검색이 같이 써요)
// 💡 값이 한 군데에만 있어야, 범위를 바꿀 때 한 곳만 고치면 돼요.

// 서울 근처를 넉넉하게 감싼 네모 (경도 x, 위도 y)
export const SEOUL = { minX: 126.7, maxX: 127.3, minY: 37.4, maxY: 37.75 } as const;

// 💡 Point 타입을 route_query에서 가져오지 않고 { x, y } 모양만 받아요.
//    그래야 이 파일이 routes 쪽에 기대지 않는 "바닥" 모듈로 남아요.
export function inSeoul(p: { x: number; y: number }): boolean {
    return p.x >= SEOUL.minX && p.x <= SEOUL.maxX && p.y >= SEOUL.minY && p.y <= SEOUL.maxY;
}
