import {Processor, SourceLinkHint} from "../../types";
import {Editor} from "codemirror";
import {displaySourcePopovers, getMDHintLinks, getVisibleLineText} from "../utils/common";

export default class LegacySourceLinkProcessor implements Processor {
    cmEditor: Editor;
    letters: string;

    constructor(editor: Editor, alphabet: string) {
        this.cmEditor = editor;
        this.letters = alphabet;
    }

    public init() {
        const { cmEditor } = this;

        const linkHints = this.getSourceLinkHints(cmEditor);
        displaySourcePopovers(cmEditor, linkHints);

        return linkHints;
    }

    private getSourceLinkHints = (cmEditor: Editor): SourceLinkHint[] => {
        const { letters } = this;
        const { indOffset, strs } = getVisibleLineText(cmEditor);

        return getMDHintLinks(strs, indOffset, letters);
    }
}