import {WidgetType} from "@codemirror/view";

export class MarkWidget extends WidgetType {
    constructor(readonly mark: string, readonly type: string, readonly matchedEventKey: string) {
        super();
    }

    eq(other: MarkWidget) {
        return other.mark === this.mark && other.matchedEventKey == this.matchedEventKey;
    }

    toDOM() {
        // The Obsidian element helpers on a Node append what they create to that
        // node, so `activeDocument.createDiv()` would try to append to the document
        // itself and throw. A widget has to be detached, so build it by hand.
        const wrapper = activeDocument.createElement("div");
        wrapper.classList.add("jl", "jl-" + this.type, "jl-inline", "popover");
        if (this.matchedEventKey && this.mark.toUpperCase().startsWith(this.matchedEventKey.toUpperCase())) {
            wrapper.classList.add('matched');
        }
        wrapper.createSpan({text: this.mark});

        return wrapper;
    }

    ignoreEvent() {
        return false;
    }
}
