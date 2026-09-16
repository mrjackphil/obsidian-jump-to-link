import {WidgetType} from "@codemirror/view";

export class MarkWidget extends WidgetType {
    constructor(readonly mark: string, readonly type: string, readonly matchedEventKey: string) {
        super();
    }

    eq(other: MarkWidget) {
        return other.mark === this.mark && other.matchedEventKey == this.matchedEventKey;
    }

    toDOM() {
        // The window level `createDiv` returns a DETACHED element, while the Node
        // level helpers append to the node they are called on - so
        // `activeDocument.createDiv()` would throw. A widget has to be detached.
        const cls = ["jl", "jl-" + this.type, "jl-inline", "popover"];
        if (this.matchedEventKey && this.mark.toUpperCase().startsWith(this.matchedEventKey.toUpperCase())) {
            cls.push('matched');
        }
        const wrapper = createDiv({cls});
        wrapper.createSpan({text: this.mark});

        return wrapper;
    }

    ignoreEvent() {
        return false;
    }
}
