import {Editor} from "codemirror";
import {Processor, SourceLinkHint} from "../../types";
import {displaySourcePopovers, getLinkHintLetters, getVisibleLineText} from "../utils/common";

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
        const { regexp, letters } = this;
        const regExUrl = new RegExp(regexp, 'g');

        let linksWithIndex: {
            index: number;
            type: "regex";
            linkText: string;
        }[] = [];

        let regExResult;

        while ((regExResult = regExUrl.exec(content))) {
            const linkText = regExResult[1];
            linksWithIndex.push({
                index: regExResult.index + offset,
                type: "regex",
                linkText,
            });
        }

        const linkHintLetters = getLinkHintLetters(letters, linksWithIndex.length);

        const linksWithLetter: SourceLinkHint[] = [];
        linksWithIndex
            .sort((x, y) => x.index - y.index)
            .forEach((linkHint, i) => {
                linksWithLetter.push({
                    letter: linkHintLetters[i],
                    ...linkHint,
                });
            });

        return linksWithLetter.filter(link => link.letter);
    }

    private display(links: SourceLinkHint[]): void {
        const { cmEditor } = this
        displaySourcePopovers(cmEditor, links);
    }
}