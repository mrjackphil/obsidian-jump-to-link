import {PreviewLinkHint, SourceLinkHint} from "../../types";
import {EditorView} from "@codemirror/view";
import {displayPreviewPopovers, getPreviewLinkHints} from "../utils/preview";

import {getLinkHintLetters, getMDHintLinks} from "../utils/common";
import {getVisibleRange} from "../utils/cm6-internals";

export default class LivePreviewLinkProcessor {
    view: HTMLElement;
    cmEditor: EditorView;
    alphabet: string;

    constructor(view: HTMLElement, editor: EditorView, alphabet: string) {
        this.view = view;
        this.cmEditor = editor
        this.alphabet = alphabet;
    }

    public init(): [PreviewLinkHint[],SourceLinkHint[],HTMLElement[]] {
        const { view, alphabet } = this
        const links = getPreviewLinkHints(view, alphabet);
        const sourceLinks = this.getSourceLinkHints();
        const linkHintLetters = getLinkHintLetters(alphabet, links.length + sourceLinks.length);
        const linksRemapped = links.map((link, idx) => ({...link, letter: linkHintLetters[idx]})).filter(link => link.letter)
        const sourceLinksRemapped = sourceLinks.map((link, idx) => ({...link, letter: linkHintLetters[idx + links.length]})).filter(link => link.letter)
        const linkHintHtmlElements = displayPreviewPopovers(linksRemapped);
        return [linksRemapped, sourceLinksRemapped, linkHintHtmlElements];
    }

    public getVisibleLines() {
        return getVisibleRange(this.cmEditor);
    }

    private getSourceLinkHints = (): SourceLinkHint[] => {
        const { alphabet } = this;
        const { index, content } = this.getVisibleLines();

        return getMDHintLinks(content, index, alphabet);
    }
}