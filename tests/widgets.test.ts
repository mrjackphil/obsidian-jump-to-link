// @vitest-environment jsdom
import {beforeAll, describe, expect, it} from "vitest";
import {installObsidianDom} from "./obsidian-dom";
import {createWidgetElement} from "../src/utils/common";
import {MarkWidget} from "../src/cm6-widget/MarkWidget";

beforeAll(() => {
    installObsidianDom(document, window);
});

/**
 * Both hint builders have to hand back a DETACHED element: CodeMirror inserts
 * the widget itself, and the legacy editor passes the node to `addWidget`.
 * Building one with an Obsidian helper that parents to `activeDocument` throws,
 * which takes down every hint in the editor - see the regression test below.
 */
describe("createWidgetElement", () => {
    it("returns a detached element", () => {
        const el = createWidgetElement("A", "internal");
        expect(el.parentNode).toBeNull();
        expect(el.isConnected).toBe(false);
    });

    it("builds a div carrying the hint classes", () => {
        const el = createWidgetElement("A", "internal");
        expect(el.tagName).toBe("DIV");
        expect([...el.classList].sort()).toEqual(["jl", "jl-internal", "popover"]);
    });

    it("renders the letter as text, never as markup", () => {
        const el = createWidgetElement("<img src=x onerror=alert(1)>", "internal");
        expect(el.textContent).toBe("<img src=x onerror=alert(1)>");
        expect(el.children).toHaveLength(0);
    });

    it("tags the hint with its link type", () => {
        expect(createWidgetElement("A", "external").classList.contains("jl-external")).toBe(true);
        expect(createWidgetElement("A", "regex").classList.contains("jl-regex")).toBe(true);
    });
});

describe("MarkWidget.toDOM", () => {
    it("returns a detached element", () => {
        const el = new MarkWidget("A", "internal", undefined).toDOM();
        expect(el.parentNode).toBeNull();
        expect(el.isConnected).toBe(false);
    });

    it("carries the classes the stylesheet expects", () => {
        const el = new MarkWidget("A", "internal", undefined).toDOM();
        // jl-inline replaces the inline display/position styles
        expect([...el.classList].sort()).toEqual(["jl", "jl-inline", "jl-internal", "popover"]);
    });

    it("puts the hint letter in a nested span", () => {
        const el = new MarkWidget("AB", "internal", undefined).toDOM();
        expect(el.textContent).toBe("AB");
        expect(el.querySelector("span")?.textContent).toBe("AB");
    });

    it("marks a hint whose prefix was typed", () => {
        const el = new MarkWidget("AB", "internal", "a").toDOM();
        expect(el.classList.contains("matched")).toBe(true);
    });

    it("leaves a hint alone when a different prefix was typed", () => {
        const el = new MarkWidget("AB", "internal", "z").toDOM();
        expect(el.classList.contains("matched")).toBe(false);
    });
});

describe("the Obsidian helper that broke the hints", () => {
    it("throws when a Node level helper is called on the document", () => {
        // This is what activeDocument.createDiv() does: parent = document, then
        // document.appendChild(el). Documents may hold only one element child.
        expect(() => (activeDocument as unknown as {
            createDiv(o: {cls: string}): HTMLElement
        }).createDiv({cls: "jl"})).toThrow();
    });

    it("returns a detached element from the window level helper", () => {
        const el = (activeWindow as unknown as {
            createDiv(o: {cls: string}): HTMLElement
        }).createDiv({cls: "jl"});
        expect(el.parentNode).toBeNull();
    });
});
