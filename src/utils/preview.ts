import {LinkHintType, PreviewLinkHint} from "../../types";
import {getLinkHintLetters} from "./common";

export function getPreviewLinkHints(previewViewEl: HTMLElement, letters: string ): PreviewLinkHint[] {
    const anchorEls = previewViewEl.querySelectorAll<HTMLAnchorElement>('a, .metadata-link-inner');
    const embedEls = previewViewEl.querySelectorAll('.internal-embed');

    const linkHints: PreviewLinkHint[] = [];
    anchorEls.forEach((anchorEl, _i) => {
        if (checkIsPreviewElOnScreen(previewViewEl, anchorEl)) {
            return
        }

        const linkType: LinkHintType = anchorEl.classList.contains('internal-link')
            ? 'internal'
            : 'external';

        const linkText = linkType === 'internal'
            ? anchorEl.dataset['href'] ?? anchorEl.href
            : anchorEl.href;

        let offsetParent = anchorEl.offsetParent as HTMLElement;
        let top = anchorEl.offsetTop;
        let left = anchorEl.offsetLeft;

        while (offsetParent) {
            if (offsetParent == previewViewEl) {
                offsetParent = undefined;
            } else {
                top += offsetParent.offsetTop;
                left += offsetParent.offsetLeft;
                offsetParent = offsetParent.offsetParent as HTMLElement;
            }
        }
        linkHints.push({
            linkElement: anchorEl,
            letter: '',
            linkText: linkText,
            type: linkType,
            top: top,
            left: left,
        });
    });

    embedEls.forEach((embedEl, _i) => {
        const linkText = embedEl.getAttribute('src');
        const linkEl = embedEl.querySelector<HTMLElement>('.markdown-embed-link');

        if (linkText && linkEl) {
            if (checkIsPreviewElOnScreen(previewViewEl, linkEl)) {
                return
            }

            let offsetParent = linkEl.offsetParent as HTMLElement;
            let top = linkEl.offsetTop;
            let left = linkEl.offsetLeft;

            while (offsetParent) {
                if (offsetParent == previewViewEl) {
                    offsetParent = undefined;
                } else {
                    top += offsetParent.offsetTop;
                    left += offsetParent.offsetLeft;
                    offsetParent = offsetParent.offsetParent as HTMLElement;
                }
            }

            linkHints.push({
                linkElement: linkEl,
                letter: '',
                linkText: linkText,
                type: 'internal',
                top: top,
                left: left,
            });
        }
    });

    const sortedLinkHints = linkHints.sort((a, b) => {
        if (a.top > b.top) {
            return 1;
        } else if (a.top === b.top) {
            if (a.left > b.left) {
                return 1;
            } else if (a.left === b.left) {
                return 0;
            } else {
                return -1;
            }
        } else {
            return -1;
        }
    });

    const linkHintLetters = getLinkHintLetters(letters, sortedLinkHints.length);

    sortedLinkHints.forEach((linkHint, i) => {
        linkHint.letter = linkHintLetters[i];
    });

    return sortedLinkHints;
}

export function checkIsPreviewElOnScreen(parent: HTMLElement, el: HTMLElement) {
    el = el.closest('[data-view-type="table"], table') || el;
    return el.offsetTop < parent.scrollTop || el.offsetTop > parent.scrollTop + parent.offsetHeight
}

export function displayPreviewPopovers(linkHints: PreviewLinkHint[]): HTMLElement[] {
    const linkHintHtmlElements: HTMLElement[] = []
    for (const linkHint of linkHints) {
        linkHint.linkElement.classList.add('jl-anchor');
        const popoverElement = linkHint.linkElement.createSpan({
            text: linkHint.letter,
            cls: ['jl', 'jl-' + linkHint.type, 'jl-preview', 'popover'],
        });
        linkHintHtmlElements.push(popoverElement)
    }
    return linkHintHtmlElements
}
