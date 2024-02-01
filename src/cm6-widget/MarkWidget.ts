import {WidgetType} from "@codemirror/view";

export class MarkWidget extends WidgetType {
    constructor(readonly mark: string, readonly type: string, readonly matchedEventKey: string) {
        super();
    }

    eq(other: MarkWidget) {
        return other.mark === this.mark && other.matchedEventKey == this.matchedEventKey;
    }

    toDOM() {
        const mark = activeDocument.createElement("span");
        mark.innerText = this.mark;

        const wrapper = activeDocument.createElement("div");
        wrapper.style.display = "inline-block";
        wrapper.style.position = "absolute";
        wrapper.classList.add('jl');
        wrapper.classList.add('jl-' + this.type);
        wrapper.classList.add('popover');
        if (this.matchedEventKey && this.mark.toUpperCase().startsWith(this.matchedEventKey.toUpperCase())) {
            wrapper.classList.add('matched');
        }
        wrapper.append(mark);

        return wrapper;
    }

    ignoreEvent() {
        return false;
    }
}
