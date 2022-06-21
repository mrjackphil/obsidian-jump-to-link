import {getLinkHintLetters} from "./common";
import {SourceLinkHint} from "../../types";

export function extractRegexpBlocks(content: string, offset: number, regexp: string, letters: string, caseSensitive: boolean) {
    const regExUrl = caseSensitive ? new RegExp(regexp, 'g') : new RegExp(regexp, 'ig');

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
