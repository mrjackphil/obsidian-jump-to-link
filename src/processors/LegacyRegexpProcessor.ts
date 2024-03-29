import {Editor} from "codemirror";
import {Processor, SourceLinkHint} from "../../types";
import {displaySourcePopovers, getVisibleLineText} from "../utils/common";
import {extractRegexpBlocks} from "../utils/regexp";

export default class LegacyRegexpProcessor implements Processor {
    cmEditor: Editor;
    regexp: string;
    letters: string;
    caseSensitive: boolean;

    constructor(cmEditor: Editor, regexp: string, alphabet: string, caseSensitive: boolean) {
        this.cmEditor = cmEditor;
        this.regexp = regexp;
        this.letters = alphabet;
        this.caseSensitive = caseSensitive;
    }

    public init(): SourceLinkHint[] {
        const [content, offset] = this.getVisibleContent();
        const links = this.getLinks(content, offset);

        this.display(links);
        return links;
    }

    private getVisibleContent(): [string, number] {
        const { cmEditor } = this;
        const { indOffset, strs } = getVisibleLineText(cmEditor);

        return [strs, indOffset];
    }

    private getLinks(content: string, offset: number): SourceLinkHint[] {
        const { regexp, letters } = this
        return extractRegexpBlocks(content, offset, regexp, letters, this.caseSensitive);
    }

    private display(links: SourceLinkHint[]): void {
        const { cmEditor } = this
        displaySourcePopovers(cmEditor, links);
    }
}
