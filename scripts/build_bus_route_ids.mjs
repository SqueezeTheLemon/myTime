// 🚌 버스 번호 → 서울 busRouteId(+배차 간격) 표를 만들어 lib/bus/bus_route_ids.json에 저장해요.
// 실행: node scripts/build_bus_route_ids.mjs
//
// 💡 왜 미리 만들어 두나요?
//   카카오는 버스 "번호"만 주고, 서울 도착정보 API는 "노선 ID"가 필요해요.
//   길찾기마다 노선 검색 API를 부르면 호출 수가 두 배가 되니까, 표를 한 번 만들어 두고 읽기만 해요.
//   노선이 새로 생기거나 바뀌면 이 스크립트를 다시 돌리면 돼요.
import { readFileSync, writeFileSync } from "node:fs";

// .env.local에서 키 읽기 ("이름 = 값"처럼 공백이 있어도 괜찮게)
function readEnvKey(name) {
    const line = readFileSync(".env.local", "utf8")
        .split("\n")
        .find((l) => l.split("=")[0].trim() === name);
    if (!line) throw new Error(`.env.local에 ${name}가 없어요`);
    return line.slice(line.indexOf("=") + 1).trim().replace(/^"|"$/g, "");
}

const key = readEnvKey("DATA_GO_KR_API_KEY");
// strSrch를 비우면 서울 노선 전체(약 1350개)가 한 번에 와요
const url = `http://ws.bus.go.kr/api/rest/busRouteInfo/getBusRouteList?serviceKey=${key}&strSrch=&resultType=json`;
const res = await fetch(url);
if (!res.ok) throw new Error(`노선 목록 요청 실패: HTTP ${res.status}`);
const data = await res.json();
if (data.msgHeader?.headerCd !== "0") throw new Error(`노선 목록 오류: ${data.msgHeader?.headerMsg}`);

// { "402": { id: "100100063", term: 9 } } — term은 배차 간격(분). 실시간 범위 밖 어림에 써요
const table = {};
const duplicated = new Set();
for (const { busRouteNm, busRouteId, term } of data.msgBody.itemList ?? []) {
    if (busRouteNm in table && table[busRouteNm].id !== busRouteId) duplicated.add(busRouteNm);
    const minutes = Number(term);
    table[busRouteNm] = { id: busRouteId, term: Number.isFinite(minutes) && minutes > 0 ? minutes : null };
}
// 같은 번호가 두 노선이면 어느 쪽인지 알 수 없으니 빼요 (→ 그 버스는 실시간 없이 placeholder)
for (const name of duplicated) delete table[name];

// 키 순서를 정렬해서 저장 → 다시 돌려도 diff가 깔끔해요
const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b, "ko")));
writeFileSync("lib/bus/bus_route_ids.json", JSON.stringify(sorted, null, 2) + "\n");
console.log(`노선 ${Object.keys(sorted).length}개 저장, 중복이라 뺀 번호 ${duplicated.size}개`, [...duplicated]);
