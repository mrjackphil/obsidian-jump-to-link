import {WidgetType} from "@codemirror/view";

export class MarkWidget extends WidgetType {
    constructor(readonly mark: string, readonly type: string) {
        super();
    }

    eq(other: MarkWidget) {
        return other.mark === this.mark;
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
        wrapper.append(mark);

        return wrapper;
    }

    ignoreEvent() {
        return false;
    }
}
