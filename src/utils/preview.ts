import {LinkHintType, PreviewLinkHint} from "../../types";
import {getLinkHintLetters} from "./common";

export function getPreviewLinkHints(previewViewEl: HTMLElement, letters: string ): PreviewLinkHint[] {
    const anchorEls = previewViewEl.querySelectorAll('a');
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
        const linkEl = embedEl.querySelector('.markdown-embed-link') as HTMLElement;

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
    return el.offsetTop < parent.scrollTop || el.offsetTop > parent.scrollTop + parent.offsetHeight
}

export function displayPreviewPopovers(linkHints: PreviewLinkHint[]): void {
    for (let linkHint of linkHints) {
        const popoverElement = linkHint.linkElement.createEl('span');
        linkHint.linkElement.style.position = 'relative'
        popoverElement.style.top = '0px';
        popoverElement.style.left = '0px';
        popoverElement.textContent = linkHint.letter;
        popoverElement.classList.add('jl');
        popoverElement.classList.add('jl-'+linkHint.type);
        popoverElement.classList.add('popover');
    }
}

