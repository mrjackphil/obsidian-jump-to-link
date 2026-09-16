/**
 * A faithful stand-in for the DOM helpers Obsidian installs on `Node` and
 * `window`. Transcribed from the shipped `obsidian.asar` bundle so the tests see
 * the same semantics the plugin meets at runtime:
 *
 *     Node.prototype.createEl = function (t, e, n) {
 *         "string" == typeof e && (e = {cls: e});
 *         (e = e || {}).parent = this;      // <- always parents to the node
 *         return createEl(t, e, n)
 *     }
 *     window.createEl = function (t, e, n) { ... f && f.appendChild(r) ... }
 *
 * The distinction matters: the `Node` methods APPEND what they create, while the
 * window level functions return a DETACHED element. Calling the appending form
 * on `activeDocument` throws, because a document may only hold one element.
 */

interface ElementInfo {
    cls?: string | string[];
    text?: string;
    parent?: Node;
    prepend?: boolean;
}

type Mutable = Record<string, unknown>;

export function installObsidianDom(doc: Document, win: Window): void {
    const createEl = (tag: string, info?: ElementInfo | string): HTMLElement => {
        const o: ElementInfo = typeof info === "string" ? {cls: info} : (info ?? {});
        const el = doc.createElement(tag);

        if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
        if (o.text) el.textContent = o.text;
        if (o.parent) {
            if (o.prepend) o.parent.insertBefore(el, o.parent.firstChild);
            else o.parent.appendChild(el);
        }
        return el;
    };

    const nodeProto = Node.prototype as unknown as Mutable;
    nodeProto.createEl = function (this: Node, tag: string, info?: ElementInfo | string) {
        const o: ElementInfo = typeof info === "string" ? {cls: info} : (info ?? {});
        o.parent = this; // the behaviour that makes activeDocument.createDiv() throw
        return createEl(tag, o);
    };
    nodeProto.createDiv = function (this: Node, info?: ElementInfo | string) {
        return (this as unknown as {createEl(t: string, i?: ElementInfo | string): HTMLElement})
            .createEl("div", info);
    };
    nodeProto.createSpan = function (this: Node, info?: ElementInfo | string) {
        return (this as unknown as {createEl(t: string, i?: ElementInfo | string): HTMLElement})
            .createEl("span", info);
    };

    const w = win as unknown as Mutable;
    w.createEl = createEl;
    w.createDiv = (info?: ElementInfo | string) => createEl("div", info);
    w.createSpan = (info?: ElementInfo | string) => createEl("span", info);

    // Obsidian exposes these for popout window support
    w.activeDocument = doc;
    w.activeWindow = win;
}
