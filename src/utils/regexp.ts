import {getLinkHintLetters} from "./common";
import {SourceLinkHint} from "../../types";

export function extractRegexpBlocks(content: string, offset: number, regexp: string, letters: string) {
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
