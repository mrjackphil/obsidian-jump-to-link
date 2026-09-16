import {describe, expect, it} from "vitest";
import {extractRegexpBlocks} from "../src/utils/regexp";

const LETTERS = "abcdefghij";
const WORDS = String.raw`\b\w{3,}\b`; // the default "jump to anywhere" pattern

const indicesOf = (...args: Parameters<typeof extractRegexpBlocks>) =>
    extractRegexpBlocks(...args).map(hint => hint.index);

describe("extractRegexpBlocks", () => {
    it("marks the start of every match", () => {
        expect(indicesOf("one two three", 0, WORDS, LETTERS, true)).toEqual([0, 4, 8]);
    });

    it("skips words shorter than the default pattern allows", () => {
        expect(indicesOf("a an and ant", 0, WORDS, LETTERS, true)).toEqual([5, 9]);
    });

    it("shifts every index by the offset of the visible range", () => {
        expect(indicesOf("one two", 100, WORDS, LETTERS, true)).toEqual([100, 104]);
    });

    it("respects case when asked to", () => {
        expect(indicesOf("Abc abc", 0, "abc", LETTERS, true)).toEqual([4]);
    });

    it("ignores case when asked to", () => {
        expect(indicesOf("Abc abc", 0, "abc", LETTERS, false)).toEqual([0, 4]);
    });

    it("tags every match as a regex hint", () => {
        const hints = extractRegexpBlocks("one two", 0, WORDS, LETTERS, true);
        expect(hints.map(h => h.type)).toEqual(["regex", "regex"]);
    });

    it("labels matches in document order", () => {
        const hints = extractRegexpBlocks("one two three", 0, WORDS, LETTERS, true);
        expect(hints.map(h => h.letter)).toEqual(["A", "B", "C"]);
    });

    it("drops matches it cannot label once the alphabet is exhausted", () => {
        const content = "aaa bbb ccc ddd eee";
        // two letters can label at most four matches
        expect(extractRegexpBlocks(content, 0, WORDS, "ab", true)).toHaveLength(4);
    });

    it("finds nothing when the pattern does not match", () => {
        expect(indicesOf("one two", 0, "zzz", LETTERS, true)).toEqual([]);
    });

    it("finds matches across several lines", () => {
        expect(indicesOf("one\ntwo\nthree", 0, WORDS, LETTERS, true)).toEqual([0, 4, 8]);
    });

    it("supports the lightspeed style of pattern", () => {
        // lightspeed builds "\b" + the typed characters
        expect(indicesOf("the tall tree", 0, String.raw`\btr`, LETTERS, true)).toEqual([9]);
    });
});
