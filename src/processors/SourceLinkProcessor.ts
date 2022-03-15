import {Processor, SourceLinkHint} from "../../types";
import {Editor} from "codemirror";
import {displaySourcePopovers, getLinkHintLetters, getVisibleLineText} from "../utils/common";

export default class SourceLinkProcessor implements Processor {
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
        // expecting either [[Link]] or [[Link|Title]]
        const regExInternal = /\[\[(.+?)(\|.+?)?]]/g;
        // expecting [Title](../example.md)
        const regExMdInternal = /\[.+?]\(((\.\.|\w|\d).+?)\)/g;
        // expecting [Title](file://link) or [Title](https://link)
        const regExExternal = /\[.+?]\(((https?:|file:).+?)\)/g;
        // expecting http://hogehoge or https://hogehoge
        const regExUrl = /(?<= |\n|^)(https?:\/\/[^ \n]+)/g;

        const { indOffset, strs } = getVisibleLineText(cmEditor);

        let linksWithIndex: { index: number, type: 'internal' | 'external', linkText: string }[] = [];
        let regExResult;

        while(regExResult = regExInternal.exec(strs)) {
            const linkText = regExResult[1];
            linksWithIndex.push({ index: regExResult.index + indOffset, type: 'internal', linkText });
        }

        while(regExResult = regExMdInternal.exec(strs)) {
            const linkText = regExResult[1];
            linksWithIndex.push({ index: regExResult.index + indOffset, type: 'internal', linkText });
        }

        while(regExResult = regExExternal.exec(strs)) {
            const linkText = regExResult[1];
            linksWithIndex.push({ index: regExResult.index + indOffset, type: 'external', linkText })
        }

        while(regExResult = regExUrl.exec(strs)) {
            const linkText = regExResult[1];
            linksWithIndex.push({ index: regExResult.index + indOffset, type: 'external', linkText })
        }

        const linkHintLetters = getLinkHintLetters(letters, linksWithIndex.length);

        const linksWithLetter: SourceLinkHint[] = [];
        linksWithIndex
            .sort((x,y) => x.index - y.index)
            .forEach((linkHint, i) => {
                linksWithLetter.push({ letter: linkHintLetters[i], ...linkHint});
            });

        return linksWithLetter.filter(link => link.letter);
    }
}