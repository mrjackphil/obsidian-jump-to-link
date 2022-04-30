import CM6LinkProcessor from "./CM6LinkProcessor";
import {Processor} from "../../types";
import {EditorView} from "@codemirror/view";
import {extractRegexpBlocks} from "../utils/regexp";

export default class CM6RegexProcessor extends CM6LinkProcessor implements Processor {
    regexp: string;
    constructor(editor: EditorView, alphabet: string, regexp: string) {
        super(editor, alphabet);
        this.regexp = regexp;
    }

    init() {
        const { letters, regexp } = this;
        const { index, content } = this.getVisibleLines();
        return extractRegexpBlocks(content, index, regexp, letters);
    }
}