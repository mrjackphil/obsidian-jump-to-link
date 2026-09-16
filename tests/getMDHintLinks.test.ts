import {describe, expect, it} from "vitest";
import {getMDHintLinks} from "../src/utils/common";

const LETTERS = "abcdefghij";

/** Drops the hint letter so the assertions describe what was found, not how it was labelled. */
function linksIn(content: string, offset = 0) {
    return getMDHintLinks(content, offset, LETTERS)
        .map(({index, type, linkText}) => ({index, type, linkText}));
}

describe("getMDHintLinks", () => {
    it("finds a wikilink", () => {
        expect(linksIn("[[Note]]")).toEqual([
            {index: 0, type: "internal", linkText: "Note"},
        ]);
    });

    it("uses the target of an aliased wikilink, not its title", () => {
        expect(linksIn("[[Note|Some title]]")).toEqual([
            {index: 0, type: "internal", linkText: "Note"},
        ]);
    });

    it("finds a relative markdown link", () => {
        expect(linksIn("[Title](../other.md)")).toEqual([
            {index: 0, type: "internal", linkText: "../other.md"},
        ]);
    });

    it("finds a bare markdown link", () => {
        expect(linksIn("[Title](other.md)")).toEqual([
            {index: 0, type: "internal", linkText: "other.md"},
        ]);
    });

    it("treats a link with a scheme as external", () => {
        expect(linksIn("[Title](https://example.com)")).toEqual([
            {index: 0, type: "external", linkText: "https://example.com"},
        ]);
    });

    it("treats any scheme as external, not just http", () => {
        expect(linksIn("[JIRA-123](jira://bla-bla)")).toEqual([
            {index: 0, type: "external", linkText: "jira://bla-bla"},
        ]);
    });

    it("finds a bare url after a space", () => {
        expect(linksIn("see https://example.com")).toEqual([
            {index: 4, type: "external", linkText: "https://example.com"},
        ]);
    });

    it("finds a bare url after a newline", () => {
        expect(linksIn("see\nhttps://example.com")).toEqual([
            {index: 4, type: "external", linkText: "https://example.com"},
        ]);
    });

    it("shifts every index by the offset of the visible range", () => {
        expect(linksIn("[[Note]]", 100)).toEqual([
            {index: 100, type: "internal", linkText: "Note"},
        ]);
    });

    it("returns links in document order", () => {
        expect(linksIn("[[One]] and [[Two]]")).toEqual([
            {index: 0, type: "internal", linkText: "One"},
            {index: 12, type: "internal", linkText: "Two"},
        ]);
    });

    it("reports each position once, preferring external over internal", () => {
        // both the external and the markdown-internal pattern match this line
        const links = linksIn("[Title](https://example.com)");
        expect(links).toHaveLength(1);
        expect(links[0].type).toBe("external");
    });

    it("finds a mix of link styles across a document", () => {
        expect(linksIn("[[A]]\n[B](b.md)\n[C](https://c.dev)\nhttps://d.dev")).toEqual([
            {index: 0, type: "internal", linkText: "A"},
            {index: 6, type: "internal", linkText: "b.md"},
            {index: 16, type: "external", linkText: "https://c.dev"},
            {index: 35, type: "external", linkText: "https://d.dev"},
        ]);
    });

    it("finds nothing in plain text", () => {
        expect(linksIn("just some words, no links here")).toEqual([]);
    });

    it("drops links it cannot label once the alphabet is exhausted", () => {
        const content = Array.from({length: 10}, (_, i) => "[[N" + i + "]]").join(" ");
        // two letters can label at most four links
        expect(getMDHintLinks(content, 0, "ab")).toHaveLength(4);
    });

    // ---------------------------------------------------------------------
    // Known bugs. These describe what the code *should* do; `it.fails` asserts
    // that it currently does not, so the suite stays green until the bug is
    // fixed - at which point the test starts failing and should lose `.fails`.
    // ---------------------------------------------------------------------

    it.fails("should place a hint on a bare url at the very start of the content", () => {
        // regExUrl captures the separator before the url and the index is
        // advanced by one to skip it, but at the start of the content the `^`
        // branch matches nothing, so the hint lands one character too far right.
        expect(linksIn("https://example.com")).toEqual([
            {index: 0, type: "external", linkText: "https://example.com"},
        ]);
    });

    it.fails("should not let an external link swallow the link before it", () => {
        // regExExternal is `\[...\]\((.+?://.+?)\)` and `.` happily crosses the
        // closing paren of an earlier link, so one match spans both links and
        // the first link loses its hint entirely.
        expect(linksIn("[B](b.md) [C](https://c.dev)")).toEqual([
            {index: 0, type: "internal", linkText: "b.md"},
            {index: 10, type: "external", linkText: "https://c.dev"},
        ]);
    });
});
