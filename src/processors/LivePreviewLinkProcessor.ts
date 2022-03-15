import {Processor, SourceLinkHint} from "../../types";
import {EditorView} from "@codemirror/view";
import {getMDHintLinks} from "../utils/common";

export default class LivePreviewLinkProcessor implements Processor {
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

        const { from, to } = cmEditor.viewport;
        const content = cmEditor.state.sliceDoc(from, to);

        return { index: from, content };
    }

    private getSourceLinkHints = (): SourceLinkHint[] => {
        const { letters } = this;
        const { index, content } = this.getVisibleLines();

        return getMDHintLinks(content, index, letters);
    }
}