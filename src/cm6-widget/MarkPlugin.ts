import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewUpdate,
} from "@codemirror/view";
import { MarkWidget } from "./MarkWidget";
import {SourceLinkHint} from "../../types";

export class MarkPlugin {
    decorations: DecorationSet;
    links: SourceLinkHint[] = [];
    matchedEventKey: string | undefined = undefined;

    constructor(_view: EditorView) {
        this.links = [];
        this.matchedEventKey = undefined;
        this.decorations = Decoration.none
    }

    setLinks(links: SourceLinkHint[]) {
        this.links = links;
        this.matchedEventKey = undefined;
    }

    clean() {
        this.links = [];
        this.matchedEventKey = undefined;
    }

    filterWithEventKey(eventKey: string) {
        if (eventKey.length != 1) return;

        this.links = this.links.filter(v => {
            return v.letter.length == 2 && v.letter[0].toUpperCase() == eventKey.toUpperCase()
        });

        this.matchedEventKey = eventKey;
    }

    get visible() {
        return this.links.length > 0;
    }

    update(_update: ViewUpdate) {
        const widgets = this.links.map((x) =>
            Decoration.widget({
                widget: new MarkWidget(x.letter, x.type, this.matchedEventKey),
                side: 1,
            }).range(x.index)
        );

        this.decorations = Decoration.set(widgets)
    }
}

