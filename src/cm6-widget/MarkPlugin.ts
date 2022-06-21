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

    constructor(_view: EditorView) {
        this.links = [];
        this.decorations = Decoration.none
    }

    setLinks(links: SourceLinkHint[]) {
        this.links = links;
    }

    clean() {
        this.links = [];
    }

    get visible() {
        return this.links.length > 0;
    }

    update(_update: ViewUpdate) {
        const widgets = this.links.map((x) =>
            Decoration.widget({
                widget: new MarkWidget(x.letter),
                side: 1,
            }).range(x.index)
        );

        this.decorations = Decoration.set(widgets)
    }
}

