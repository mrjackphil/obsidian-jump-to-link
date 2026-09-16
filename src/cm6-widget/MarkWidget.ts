import {WidgetType} from "@codemirror/view";

export class MarkWidget extends WidgetType {
    constructor(readonly mark: string, readonly type: string, readonly matchedEventKey: string) {
        super();
    }

    eq(other: MarkWidget) {
        return other.mark === this.mark && other.matchedEventKey == this.matchedEventKey;
    }

    toDOM() {
        const wrapper = activeDocument.createDiv({cls: ['jl', 'jl-' + this.type, 'jl-inline', 'popover']});
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
