import { describe, expect, it } from "vitest";
import { kakaoToPlaces, toPlace } from "./place_convert";
import { KakaoPlaceDocument } from "../kakao/local_types";

// 💡 테스트용 문서 도우미: 바꾸고 싶은 필드만 넘기고, 나머지는 서울역 기본값
function doc(overrides: Partial<KakaoPlaceDocument> = {}): KakaoPlaceDocument {
    return {
        id: "8125069",
        place_name: "서울역",
        address_name: "서울 용산구 동자동 43-205",
        road_address_name: "서울 용산구 한강대로 405",
        x: "126.9707",
        y: "37.5547",
        ...overrides,
    };
}

describe("toPlace", () => {
    it("정상 문서 → Place (x, y는 숫자)", () => {
        expect(toPlace(doc())).toEqual({
            id: "8125069",
            name: "서울역",
            address: "서울 용산구 한강대로 405",
            x: 126.9707,
            y: 37.5547,
        });
    });

    it("도로명 주소가 있으면 도로명", () => {
        expect(toPlace(doc())?.address).toBe("서울 용산구 한강대로 405");
    });

    it("도로명 주소가 빈 문자열이면 지번", () => {
        expect(toPlace(doc({ road_address_name: "" }))?.address).toBe("서울 용산구 동자동 43-205");
    });

    it("x나 y가 빈 문자열이면 null", () => {
        // 💡 Number("")는 0이라서, toNumber가 없었다면 (0, 0)으로 통과했을 거예요
        expect(toPlace(doc({ x: "" }))).toBeNull();
        expect(toPlace(doc({ y: "  " }))).toBeNull();
    });

    it("x나 y가 숫자가 아니면 null", () => {
        expect(toPlace(doc({ x: "abc" }))).toBeNull();
        expect(toPlace(doc({ y: "37.5.5" }))).toBeNull();
    });

    it("서울 밖 좌표면 null", () => {
        expect(toPlace(doc({ x: "129.0403", y: "35.1151" }))).toBeNull(); // 부산역
    });
});

describe("kakaoToPlaces", () => {
    it("쓸 수 없는 문서는 빼고 나머지만", () => {
        const res = {
            documents: [doc({ id: "a" }), doc({ id: "b", x: "" }), doc({ id: "c", x: "129.04", y: "35.11" }), doc({ id: "d" })],
        };
        expect(kakaoToPlaces(res).map((p) => p.id)).toEqual(["a", "d"]);
    });

    it("documents가 비어 있으면 빈 배열", () => {
        expect(kakaoToPlaces({ documents: [] })).toEqual([]);
    });
});
