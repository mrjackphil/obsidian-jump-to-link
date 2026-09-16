import {describe, expect, it} from "vitest";
import {getLinkHintLetters} from "../src/utils/common";

const ALPHABET = "abc";

describe("getLinkHintLetters", () => {
    it("returns nothing when there is nothing to label", () => {
        expect(getLinkHintLetters(ALPHABET, 0)).toEqual([]);
    });

    it("uppercases the configured alphabet", () => {
        expect(getLinkHintLetters("abc", 3)).toEqual(["A", "B", "C"]);
    });

    it("uses single letters while the alphabet is long enough", () => {
        expect(getLinkHintLetters(ALPHABET, 1)).toEqual(["A"]);
        expect(getLinkHintLetters(ALPHABET, 2)).toEqual(["A", "B"]);
    });

    it("promotes letters to prefixes once single letters run out", () => {
        // 'A' becomes a prefix, so it is no longer handed out on its own
        expect(getLinkHintLetters(ALPHABET, 4)).toEqual(["B", "C", "AA", "AB"]);
    });

    it("spends the whole alphabet on prefixes at full capacity", () => {
        expect(getLinkHintLetters(ALPHABET, 9)).toEqual([
            "AA", "AB", "AC",
            "BA", "BB", "BC",
            "CA", "CB", "CC",
        ]);
    });

    it("never repeats a hint", () => {
        for (let n = 0; n <= 9; n++) {
            const letters = getLinkHintLetters(ALPHABET, n);
            expect(new Set(letters).size).toBe(letters.length);
        }
    });

    it("labels every link up to alphabet.length squared", () => {
        for (let n = 0; n <= 9; n++) {
            expect(getLinkHintLetters(ALPHABET, n)).toHaveLength(n);
        }
    });

    it("runs out of hints beyond alphabet.length squared", () => {
        // documented in the README: excess links end up without a label and are
        // dropped by the callers' `.filter(link => link.letter)`
        expect(getLinkHintLetters(ALPHABET, 10)).toHaveLength(9);
    });

    it("labels a realistic page with the default alphabet", () => {
        const letters = getLinkHintLetters("sadfjklewcmpgh", 40);
        expect(letters).toHaveLength(40);
        expect(new Set(letters).size).toBe(40);
    });
});
