import {PreviewLinkHint} from "../../types";
import {displayPreviewPopovers, getPreviewLinkHints} from "../utils/preview";

export default class PreviewLinkProcessor {
    view: HTMLElement;
    alphabet: string;

    constructor(view: HTMLElement, alphabet: string) {
        this.view = view;
        this.alphabet = alphabet;
    }

    public init(): PreviewLinkHint[] {
        const { view, alphabet } = this
        const links = getPreviewLinkHints(view, alphabet);
        displayPreviewPopovers(links);
        return links;
    }
}