import {PreviewLinkHint, SourceLinkHint} from "../../types";
import {EditorView} from "@codemirror/view";
import {displayPreviewPopovers, getPreviewLinkHints} from "../utils/preview";

import {getLinkHintLetters, getMDHintLinks} from "../utils/common";

export default class LivePreviewLinkProcessor {
    view: HTMLElement;
    cmEditor: EditorView;
    alphabet: string;

    constructor(view: HTMLElement, editor: EditorView, alphabet: string) {
        this.view = view;
        this.cmEditor = editor
        this.alphabet = alphabet;
    }

    public init(): [PreviewLinkHint[],SourceLinkHint[]] {
        const { view, alphabet } = this
        const links = getPreviewLinkHints(view, alphabet);
        const sourceLinks = this.getSourceLinkHints();
        const linkHintLetters = getLinkHintLetters(alphabet, links.length + sourceLinks.length);
        const sourceLinksRemapped = sourceLinks.map((link, idx) => ({...link, letter: linkHintLetters[idx + links.length]}))
        displayPreviewPopovers(view, links);
        return [links, sourceLinksRemapped];
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
        const { alphabet } = this;
        const { index, content } = this.getVisibleLines();

        return getMDHintLinks(content, index, alphabet);
    }
}