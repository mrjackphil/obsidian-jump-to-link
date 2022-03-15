import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewUpdate,
} from "@codemirror/view";
import { MarkWidget } from "./MarkWidget";
import {SourceLinkHint} from "../../types";

export class MarkPlugin {
    links: SourceLinkHint[] = [];

    constructor(links: SourceLinkHint[]) {
        this.links = links;
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

    createMarks(): DecorationSet {
        const widgets = this.links.map((x) =>
            Decoration.widget({
                widget: new MarkWidget(x.letter),
                side: 1,
            }).range(x.index)
        );

        return Decoration.set(widgets);
    }
}

export function createViewPluginClass(markPlugin: MarkPlugin) {
    return class {
        decorations: DecorationSet;

        constructor(_view: EditorView) {
            this.decorations = markPlugin.createMarks();
        }

        update(_update: ViewUpdate) {
            this.decorations = markPlugin.createMarks();
        }
    };
}
