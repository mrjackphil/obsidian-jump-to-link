import CM6LinkProcessor from "./CM6LinkProcessor";
import {Processor} from "../../types";
import {EditorView} from "@codemirror/view";
import {extractRegexpBlocks} from "../utils/regexp";

export default class CM6RegexProcessor extends CM6LinkProcessor implements Processor {
    regexp: string;
    caseSensitive: boolean;
    constructor(editor: EditorView, alphabet: string, regexp: string, caseSensitive: boolean) {
        super(editor, alphabet);
        this.regexp = regexp;
        this.caseSensitive = caseSensitive;
    }

    init() {
        const { letters, regexp } = this;
        const { index, content } = this.getVisibleLines();
        return extractRegexpBlocks(content, index, regexp, letters, this.caseSensitive);
    }
}
