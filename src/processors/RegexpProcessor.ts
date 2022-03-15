import {Editor} from "codemirror";
import {Processor, SourceLinkHint} from "../../types";
import {displaySourcePopovers, getVisibleLineText} from "../utils/common";
import {extractRegexpBlocks} from "../utils/regexp";

export default class RegexpProcessor implements Processor {
    cmEditor: Editor;
    regexp: string;
    letters: string;

    constructor(cmEditor: Editor, regexp: string, alphabet: string) {
        this.cmEditor = cmEditor;
        this.regexp = regexp;
        this.letters = alphabet;
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
        return extractRegexpBlocks(content, offset, regexp, letters);
    }

    private display(links: SourceLinkHint[]): void {
        const { cmEditor } = this
        displaySourcePopovers(cmEditor, links);
    }
}