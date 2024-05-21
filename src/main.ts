import {App, MarkdownView, Plugin, PluginSettingTab, Setting, View, editorLivePreviewField} from 'obsidian';
import {Editor} from 'codemirror';
import {EditorSelection} from "@codemirror/state";
import {EditorView, ViewPlugin} from "@codemirror/view";
import {LinkHintBase, Settings, SourceLinkHint} from 'types';
import {MarkPlugin} from "./cm6-widget/MarkPlugin";

import CM6LinkProcessor from "./processors/CM6LinkProcessor";
import CM6RegexProcessor from "./processors/CM6RegexProcessor";
import LegacyRegexpProcessor from "./processors/LegacyRegexpProcessor";
import LegacySourceLinkProcessor from "./processors/LegacySourceLinkProcessor";
import PreviewLinkProcessor from "./processors/PreviewLinkProcessor";
import LivePreviewLinkProcessor from './processors/LivePreviewLinkProcessor';

enum VIEW_MODE {
    SOURCE,
    PREVIEW,
    LEGACY,
    LIVE_PREVIEW
}
interface CursorState {
    vimMode?: string;
    anchor?: number;
}
export default class JumpToLink extends Plugin {
    isLinkHintActive: boolean = false;
    settings: Settings;
    prefixInfo: { prefix: string, shiftKey: boolean } | undefined = undefined;
    markViewPlugin: ViewPlugin<any>
    cmEditor: Editor | EditorView
    currentView: View
    contentElement: HTMLElement
    mode: VIEW_MODE
    currentCursor: CursorState = {};
    cursorBeforeJump: CursorState = {};

    async onload() {
        this.settings = await this.loadData() || new Settings();

        this.addSettingTab(new SettingTab(this.app, this));

        const markViewPlugin = this.markViewPlugin = ViewPlugin.fromClass(MarkPlugin, {
            decorations: v => v.decorations
        });
        this.registerEditorExtension([markViewPlugin])

        this.watchForSelectionChange();

        this.addCommand({
            id: 'activate-jump-to-link',
            name: 'Jump to Link',
            callback: this.action.bind(this, 'link'),
            hotkeys: [{modifiers: ['Ctrl'], key: `'`}],
        });

        this.addCommand({
            id: "activate-jump-to-anywhere",
            name: "Jump to Anywhere Regex",
            callback: this.action.bind(this, 'regexp'),
            hotkeys: [{modifiers: ["Ctrl"], key: ";"}],
        });

        this.addCommand({
            id: "activate-lightspeed-jump",
            name: "Lightspeed Jump",
            callback: this.action.bind(this, 'lightspeed'),
            hotkeys: [],
        });
    }

    onunload() {
        console.log('unloading jump to links plugin');
    }

    action(type: 'link' | 'regexp' | 'lightspeed') {
        if (this.isLinkHintActive) {
            return;
        }

        const activeViewOfType = app.workspace.getActiveViewOfType(MarkdownView)
        const currentView = this.currentView = activeViewOfType.leaf.view;
        const mode = this.mode = this.getMode(this.currentView);
        this.contentElement = activeViewOfType.contentEl
        this.cursorBeforeJump = this.currentCursor;

        switch (mode) {
            case VIEW_MODE.LEGACY:
                this.cmEditor = (currentView as any).sourceMode.cmEditor;
                break;
            case VIEW_MODE.LIVE_PREVIEW:
            case VIEW_MODE.SOURCE:
                this.cmEditor = (<{ editor?: { cm: EditorView } }>currentView).editor.cm;
                break;
        }

        switch (type) {
            case "link":
                this.handleJumpToLink();
                return
            case "regexp":
                this.handleJumpToRegex();
                return
            case "lightspeed":
                this.handleLightspeedJump();
                return
        }
    }

    getMode(currentView: View): VIEW_MODE {
        // @ts-ignore
        const isLegacy = this.app.vault.getConfig("legacyEditor")

        if (currentView.getState().mode === 'preview') {
            return VIEW_MODE.PREVIEW;
        } else if (isLegacy) {
            return VIEW_MODE.LEGACY;
        } else if (currentView.getState().mode === 'source') {
            const isLivePreview = (<{ editor?: { cm: EditorView } }>currentView).editor.cm.state.field(editorLivePreviewField)
            if (isLivePreview) return VIEW_MODE.LIVE_PREVIEW;
            return VIEW_MODE.SOURCE;
        }

    }

    handleJumpToLink = () => {
        const {settings: {letters} } = this

        const { mode, currentView } = this;

        switch (mode) {
            case VIEW_MODE.LEGACY: {
                const cmEditor = this.cmEditor as Editor;
                const sourceLinkHints = new LegacySourceLinkProcessor(cmEditor, letters).init();
                this.handleActions(sourceLinkHints);
                break;
            }
            case VIEW_MODE.LIVE_PREVIEW: {
                const cm6Editor = this.cmEditor as EditorView;
                const previewViewEl: HTMLElement = (currentView as any).currentMode.editor.containerEl;
                const [previewLinkHints, sourceLinkHints, linkHintHtmlElements] = new LivePreviewLinkProcessor(previewViewEl, cm6Editor, letters).init();
                cm6Editor.plugin(this.markViewPlugin).setLinks(sourceLinkHints);
                this.app.workspace.updateOptions();
                this.handleActions([...previewLinkHints, ...sourceLinkHints], linkHintHtmlElements);
                break;
            }
            case VIEW_MODE.PREVIEW: {
                const previewViewEl: HTMLElement = (currentView as any).previewMode.containerEl.querySelector('div.markdown-preview-view');
                const previewLinkHints = new PreviewLinkProcessor(previewViewEl, letters).init();
                this.handleActions(previewLinkHints);
                break;
            }
            case VIEW_MODE.SOURCE: {
                const cm6Editor = this.cmEditor as EditorView;
                const livePreviewLinks = new CM6LinkProcessor(cm6Editor, letters).init();
                cm6Editor.plugin(this.markViewPlugin).setLinks(livePreviewLinks);
                this.app.workspace.updateOptions();
                this.handleActions(livePreviewLinks);
                break;
            }
        }
    }

    /*
    *  caseSensitive is only for lightspeed and shall not affect jumpToAnywhere, so it is true
    *  by default
    */
    handleJumpToRegex = (stringToSearch?: string, caseSensitive: boolean = true) => {
        const {settings: {letters, jumpToAnywhereRegex}} = this
        const whatToLookAt = stringToSearch || jumpToAnywhereRegex;

        const { mode } = this

        switch (mode) {
            case VIEW_MODE.SOURCE:
                this.handleMarkdownRegex(letters, whatToLookAt, caseSensitive);
                break;
            case VIEW_MODE.LIVE_PREVIEW:
                this.handleMarkdownRegex(letters, whatToLookAt, caseSensitive);
                break
            case VIEW_MODE.PREVIEW:
                break;
            case VIEW_MODE.LEGACY:
                const cmEditor = this.cmEditor as Editor
                const links = new LegacyRegexpProcessor(cmEditor, whatToLookAt, letters, caseSensitive).init();
                this.handleActions(links);
                break;
            default:
                break;
        }

    }

    handleMarkdownRegex = (letters: string, whatToLookAt: string, caseSensitive: boolean) => {
        const cm6Editor = this.cmEditor as EditorView
        const livePreviewLinks = new CM6RegexProcessor(cm6Editor, letters, whatToLookAt, caseSensitive).init();
        cm6Editor.plugin(this.markViewPlugin).setLinks(livePreviewLinks);
        this.app.workspace.updateOptions();
        this.handleActions(livePreviewLinks);
    }

    // adapted from: https://github.com/mrjackphil/obsidian-jump-to-link/issues/35#issuecomment-1085905668
    handleLightspeedJump() {
        // get all text color
        const { contentEl } = app.workspace.getActiveViewOfType(MarkdownView);
        if (!contentEl) {return}

        // this element doesn't exist in cm5/has a different class, so lightspeed will not work in cm5
        const contentContainerColor = contentEl.getElementsByClassName("cm-contentContainer");
        const originalColor = (contentContainerColor[0] as HTMLElement).style.color;

        // change all text color to gray
        (contentContainerColor[0] as HTMLElement).style.color = 'var(--jump-to-link-lightspeed-color)';

        const keyArray: string[] = [];
        const grabKey = (event: KeyboardEvent) => {
            event.preventDefault();

            // handle Escape to reject the mode
            if (event.key === 'Escape') {
                contentEl.removeEventListener("keydown", grabKey, { capture: true });
                (contentContainerColor[0] as HTMLElement).style.color = originalColor;
            }

            // test if keypress is capitalized
            if (/^[\w\S\W]$/i.test(event.key)) {
                const isCapital = event.shiftKey;
                if (isCapital) {
                    // capture uppercase
                    keyArray.push((event.key).toUpperCase());
                } else {
                    // capture lowercase
                    keyArray.push(event.key);
                }
            }

            // stop when length of array is equal to 2
            if (keyArray.length === 2) {
                const stringToSearch = this.settings.lightspeedJumpToStartOfWord ? "\\b" + keyArray.join("") : keyArray.join("");

                this.handleJumpToRegex(stringToSearch, this.settings.lightspeedCaseSensitive);

                // removing eventListener after proceeded
                contentEl.removeEventListener("keydown", grabKey, { capture: true });
                (contentContainerColor[0] as HTMLElement).style.color = originalColor;
            }
        }
        contentEl.addEventListener('keydown', grabKey, { capture: true });
    }

    handleHotkey(heldShiftKey: boolean, link: SourceLinkHint | LinkHintBase) {
        if (link.type === 'internal') {
            const file = this.app.workspace.getActiveFile()
            if (file) {
                // the second argument is for the link resolution
                this.app.workspace.openLinkText(decodeURI(link.linkText), file.path, heldShiftKey, {active: true});
            }
        } else if (link.type === 'external') {
            window.open(link.linkText);
        } else {
            const editor = this.cmEditor;
            if (editor instanceof EditorView) {
                const index = (link as SourceLinkHint).index;
                const {vimMode, anchor} = this.cursorBeforeJump;
                const useSelection = heldShiftKey || (vimMode === 'visual' || vimMode === 'visual block')

                if (useSelection && anchor !== undefined) {
                    editor.dispatch({selection: EditorSelection.range(anchor, index)})
                } else {
                    editor.dispatch({ selection: EditorSelection.cursor(index) })
                }
            } else {
                editor.setCursor(editor.posFromIndex((<SourceLinkHint>link).index));
            }
        }
    }

    removePopovers(linkHintHtmlElements: HTMLElement[] | undefined = []) {
        const currentView = this.contentElement;

        currentView.removeEventListener('click', () => this.removePopovers(linkHintHtmlElements))
        linkHintHtmlElements?.forEach(e => e.remove());
        currentView.querySelectorAll('.jl.popover').forEach(e => e.remove());

        this.prefixInfo = undefined;
        if (this.mode == VIEW_MODE.SOURCE || this.mode == VIEW_MODE.LIVE_PREVIEW) {
            (this.cmEditor as EditorView).plugin(this.markViewPlugin).clean();
        }
        this.app.workspace.updateOptions();
        this.isLinkHintActive = false;
    }

    removePopoversWithoutPrefixEventKey(eventKey: string, linkHintHtmlElements: HTMLElement[] | undefined = []) {
        const currentView = this.contentElement;

        linkHintHtmlElements?.forEach(e => {
            if (e.innerHTML.length == 2 && e.innerHTML[0] == eventKey) {
                e.classList.add("matched");
                return;
            }

            e.remove();
        });

        currentView.querySelectorAll('.jl.popover').forEach(e => {
            if (e.innerHTML.length == 2 && e.innerHTML[0] == eventKey) {
                e.classList.add("matched");
                return;
            }

            e.remove();
        });

        if (this.mode == VIEW_MODE.SOURCE || this.mode == VIEW_MODE.LIVE_PREVIEW) {
            (this.cmEditor as EditorView).plugin(this.markViewPlugin).filterWithEventKey(eventKey);
        }
        this.app.workspace.updateOptions();
    }

    handleActions(linkHints: LinkHintBase[], linkHintHtmlElements?: HTMLElement[]): void {
        const contentElement = this.contentElement
        if (!linkHints.length) {
            return;
        }

        const linkHintMap: { [letter: string]: LinkHintBase } = {};
        linkHints.forEach(x => linkHintMap[x.letter] = x);

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (['Shift', 'Control', 'CapsLock', 'ScrollLock'].includes(event.key)) {
                return;
            }

            const eventKey = event.key.toUpperCase();
            const prefixes = new Set(Object.keys(linkHintMap).filter(x => x.length > 1).map(x => x[0]));

            let linkHint: LinkHintBase;
            if (this.prefixInfo) {
                linkHint = linkHintMap[this.prefixInfo.prefix + eventKey];
            } else {
                linkHint = linkHintMap[eventKey];
                if (!linkHint && prefixes && prefixes.has(eventKey)) {
                    this.prefixInfo = {prefix: eventKey, shiftKey: event.shiftKey};

                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    this.removePopoversWithoutPrefixEventKey(eventKey, linkHintHtmlElements);

                    return;
                }
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const heldShiftKey = this.prefixInfo?.shiftKey || event.shiftKey;

            linkHint && this.handleHotkey(heldShiftKey, linkHint);

            this.removePopovers(linkHintHtmlElements);
            contentElement.removeEventListener('keydown', handleKeyDown, { capture: true });
        };

        if (linkHints.length === 1 && this.settings.jumpToLinkIfOneLinkOnly) {
            const heldShiftKey = this.prefixInfo?.shiftKey;
            this.handleHotkey(heldShiftKey, linkHints[0]);
            this.removePopovers(linkHintHtmlElements);
            return
        }

        contentElement.addEventListener('click', () => this.removePopovers(linkHintHtmlElements))
        contentElement.addEventListener('keydown', handleKeyDown, { capture: true });
        this.isLinkHintActive = true;
    }

    /**
     * CodeMirror's vim automatically exits visual mode when executing a command.
     * This keeps track of selection changes so we can restore the selection.
     *
     * This is the same approach taken by the obsidian-vimrc-plugin
     */
    watchForSelectionChange() {
        const updateSelection = this.updateSelection.bind(this)
        const watchForChanges = () => {
            const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
            const cm: Editor | undefined = (editor as any)?.cm?.cm;

            if (cm && !(cm as any)._handlers.cursorActivity.includes(updateSelection)) {
                cm.on("cursorActivity", updateSelection);
                this.register(() => cm.off("cursorActivity", updateSelection));
            }
        }
        this.registerEvent(this.app.workspace.on("active-leaf-change", watchForChanges));
        this.registerEvent(this.app.workspace.on("file-open", watchForChanges));
        watchForChanges();
    }

    updateSelection(editor: Editor) {
        const anchor = editor.listSelections()[0]?.anchor
        this.currentCursor = {
            anchor: anchor ? editor.indexFromPos(anchor) : undefined,
            vimMode: editor.state.vim?.mode
        }
    }
}

class SettingTab extends PluginSettingTab {
    plugin: JumpToLink

    constructor(app: App, plugin: JumpToLink) {
        super(app, plugin)

        this.plugin = plugin
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Settings for Jump To Link.'});

        new Setting(containerEl)
            .setName('Characters used for link hints')
            .setDesc('The characters placed next to each link after enter link-hint mode.')
            .addText(cb => {
                cb.setValue(this.plugin.settings.letters)
                    .onChange((value: string) => {
                        this.plugin.settings.letters = value
                        this.plugin.saveData(this.plugin.settings)
                    })
            });

        new Setting(containerEl)
            .setName('Jump To Anywhere')
            .setDesc("Regex based navigating in editor mode")
            .addText((text) =>
                text
                    .setPlaceholder('Custom Regex')
                    .setValue(this.plugin.settings.jumpToAnywhereRegex)
                    .onChange(async (value) => {
                        this.plugin.settings.jumpToAnywhereRegex = value;
                        await this.plugin.saveData(this.plugin.settings);
                    })
            );

        new Setting(containerEl)
            .setName('Lightspeed regex case sensitivity')
            .setDesc(
                'If enabled, the regex for matching will be case sensitive.'
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.lightspeedCaseSensitive)
                    .onChange(async (state) => {
                    this.plugin.settings.lightspeedCaseSensitive = state;
                    await this.plugin.saveData(this.plugin.settings);
                });
            });

        new Setting(containerEl)
            .setName('Jump to Link If Only One Link In Page')
            .setDesc(
                'If enabled, auto jump to link if there is only one link in page'
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.jumpToLinkIfOneLinkOnly)
                    .onChange(async (state) => {
                    this.plugin.settings.jumpToLinkIfOneLinkOnly = state;
                    await this.plugin.saveData(this.plugin.settings);
                });
            });

        new Setting(containerEl)
            .setName('Lightspeed only jumps to start of words')
            .setDesc(
                'If enabled, lightspeed jumps will only target characters occuring at the start of words.'
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.lightspeedJumpToStartOfWord)
                    .onChange(async (state) => {
                    this.plugin.settings.lightspeedJumpToStartOfWord = state;
                    await this.plugin.saveData(this.plugin.settings);
                });
            });
    }
}
