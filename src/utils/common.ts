import {Editor} from "codemirror";
import {SourceLinkHint} from "../../types";

/**
 * Get only visible content
 * @param cmEditor
 * @returns Letter offset and visible content as a string
 */
export function getVisibleLineText(cmEditor: Editor): { indOffset: number, strs: string } {
    const scrollInfo = cmEditor.getScrollInfo();
    const { line: from } = cmEditor.coordsChar({ left: 0, top: 0 }, 'page');
    const { line: to } = cmEditor.coordsChar({ left: scrollInfo.left, top: scrollInfo.top + scrollInfo.height})
    const indOffset = cmEditor.indexFromPos({ch:0, line: from})
    const strs = cmEditor.getRange({ch: 0, line: from}, {ch: 0, line: to + 1})

    return { indOffset, strs };
}

/**
 *
 * @param alphabet - Letters which used to produce hints
 * @param numLinkHints - Count of needed links
 */
export function getLinkHintLetters(alphabet: string, numLinkHints: number): string[] {
    const alphabetUppercase = alphabet.toUpperCase()

    let prefixCount = Math.ceil((numLinkHints - alphabetUppercase.length) / (alphabetUppercase.length - 1))

    // ensure 0 <= prefixCount <= alphabet.length
    prefixCount = Math.max(prefixCount, 0);
    prefixCount = Math.min(prefixCount, alphabetUppercase.length);

    const prefixes = ['', ...Array.from(alphabetUppercase.slice(0, prefixCount))];

    const linkHintLetters = []
    for (let i = 0; i < prefixes.length; i++) {
        const prefix = prefixes[i]
        for (let j = 0; j < alphabetUppercase.length; j++) {
            if (linkHintLetters.length < numLinkHints) {
                const letter = alphabetUppercase[j];
                if (prefix === '') {
                    if (!prefixes.contains(letter)) {
                        linkHintLetters.push(letter);
                    }
                } else {
                    linkHintLetters.push(prefix + letter)
                }
            } else {
                break;
            }
        }
    }

    return linkHintLetters;
}

export function getMDHintLinks(content: string, offset: number, letters: string): SourceLinkHint[] {
    // expecting either [[Link]] or [[Link|Title]]
    const regExInternal = /\[\[(.+?)(\|.+?)?]]/g;
    // expecting [Title](../example.md)
    const regExMdInternal = /\[[^\[\]]+?\]\(((\.\.|\w|\d).+?)\)/g;
    // expecting [Title](file://link), [Title](https://link) or any other [Jira-123](jira://bla-bla) link
    const regExExternal = /\[[^\[\]]+?\]\((.+?:\/\/.+?)\)/g;
    // expecting http://hogehoge or https://hogehoge
    const regExUrl = /( |\n|^)(https?:\/\/[^ \n]+)/g;

    type IndexedLink = { index: number, type: 'internal' | 'external', linkText: string }
    let indexes = new Set<number>()
    let linksWithIndex: IndexedLink[] = [];
    let regExResult;

    const addLinkToArray = (link: IndexedLink) => {
        if(indexes.has(link.index)) return
        indexes.add(link.index)
        linksWithIndex.push(link)
    }

    while(regExResult = regExInternal.exec(content)) {
        const linkText = regExResult[1]?.trim();
        addLinkToArray({ index: regExResult.index + offset, type: 'internal', linkText });
    }

    // External Link above internal, to prefer type external over interal in case of a dupe
    while(regExResult = regExExternal.exec(content)) {
        const linkText = regExResult[1];
        addLinkToArray({ index: regExResult.index + offset, type: 'external', linkText })
    }

    while(regExResult = regExMdInternal.exec(content)) {
        const linkText = regExResult[1];
        addLinkToArray({ index: regExResult.index + offset, type: 'internal', linkText });
    }

    while(regExResult = regExUrl.exec(content)) {
        const linkText = regExResult[2];
        addLinkToArray({ index: regExResult.index + offset + 1, type: 'external', linkText })
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

export function createWidgetElement(content: string, type: string) {
    const linkHintEl = activeDocument.createElement('div');
    linkHintEl.classList.add('jl');
    linkHintEl.classList.add('jl-'+type);
    linkHintEl.classList.add('popover');
    linkHintEl.innerHTML = content;
    return linkHintEl;
}

export function displaySourcePopovers(cmEditor: Editor, linkKeyMap: SourceLinkHint[]): void {
    const drawWidget = (cmEditor: Editor, linkHint: SourceLinkHint) => {
        const pos = cmEditor.posFromIndex(linkHint.index);
        // the fourth parameter is undocumented. it specifies where the widget should be place
        return (cmEditor as any).addWidget(pos, createWidgetElement(linkHint.letter, linkHint.type), false, 'over');
    }

    linkKeyMap.forEach(x => drawWidget(cmEditor, x));
}

