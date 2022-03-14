import {Editor} from "codemirror";
import {LinkHintBase, SourceLinkHint} from "../types";
import {displaySourcePopovers, getLinkHintLetters, getVisibleLineText} from "./common";

type Callback = (links: LinkHintBase[], editor: Editor) => void

export class RegexpProcessor {
    cmEditor: Editor;
    regexp: string;
    alphabet: string;

    constructor(cmEditor: Editor, regexp: string, alphabet: string) {
        this.cmEditor = cmEditor;
        this.regexp = regexp;
        this.alphabet = alphabet;
    }

    init(cb: Callback) {
        const [content, offset] = this.getVisibleContent();
        const links = this.getLinks(content, offset);

        this.display(links);
        this.callback(cb, links);
    }

    getVisibleContent(): [string, number] {
        const { cmEditor } = this;
        const { indOffset, strs } = getVisibleLineText(cmEditor);

        return [strs, indOffset];
    }

    getLinks(content: string, offset: number): SourceLinkHint[] {
        const { regexp, alphabet } = this;
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

        const linkHintLetters = getLinkHintLetters(alphabet, linksWithIndex.length);

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

    display(links: SourceLinkHint[]): void {
        const { cmEditor } = this
        displaySourcePopovers(cmEditor, links);
    }

    callback(fn: Callback, hints: LinkHintBase[]): void {
        const { cmEditor } = this
        fn(hints, cmEditor);
    }
}