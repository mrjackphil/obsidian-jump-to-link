import {Processor, SourceLinkHint} from "../../types";
import {EditorView} from "@codemirror/view";
import {getMDHintLinks} from "../utils/common";

export default class CM6LinkProcessor implements Processor {
    cmEditor: EditorView;
    letters: string;

    constructor(editor: EditorView, alphabet: string) {
        this.cmEditor = editor;
        this.letters = alphabet;
    }

    public init(): SourceLinkHint[] {
        return this.getSourceLinkHints();
    }

    public getVisibleLines() {
        const { cmEditor } = this;

        let { from, to } = cmEditor.viewport;

        // For CM6 get real visible lines top
        // @ts-ignore
        if (cmEditor.viewState?.pixelViewport?.top) {
            // @ts-ignore
            const pixelOffsetTop = cmEditor.viewState.pixelViewport.top
            // @ts-ignore
            const lines = cmEditor.viewState.viewportLines

            // @ts-ignore
            from = lines.filter(line => line.top > pixelOffsetTop)[0]?.from
        }

        const content = cmEditor.state.sliceDoc(from, to);

        return { index: from, content };
    }

    private getSourceLinkHints = (): SourceLinkHint[] => {
        const { letters } = this;
        const { index, content } = this.getVisibleLines();

        return getMDHintLinks(content, index, letters);
    }
}