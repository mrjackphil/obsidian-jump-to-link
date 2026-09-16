import {EditorView} from "@codemirror/view";

/**
 * `viewState` is internal to CodeMirror 6 and is not part of its public typings,
 * but it is the only way to learn which lines are actually on screen.
 */
interface ViewStateInternals {
    pixelViewport?: { top: number };
    viewportLines?: { top: number, from: number }[];
}

/**
 * Returns the range of the document which is visible on screen, trimming the
 * lines CodeMirror renders above the viewport when that information is available.
 */
export function getVisibleRange(cmEditor: EditorView): { index: number, content: string } {
    let { from } = cmEditor.viewport;
    const { to } = cmEditor.viewport;

    const viewState = (cmEditor as unknown as { viewState?: ViewStateInternals }).viewState;
    const pixelOffsetTop = viewState?.pixelViewport?.top;

    if (pixelOffsetTop) {
        const lines = viewState.viewportLines ?? [];
        from = lines.filter(line => line.top > pixelOffsetTop)[0]?.from;
    }

    return { index: from, content: cmEditor.state.sliceDoc(from, to) };
}
