import {App, Plugin, PluginSettingTab, Setting, View} from 'obsidian';
import {Editor} from 'codemirror';
import {LinkHintBase, Settings, SourceLinkHint} from 'types';
import RegexpProcessor from "./processors/RegexpProcessor";
import PreviewLinkProcessor from "./processors/PreviewLinkProcessor";
import SourceLinkProcessor from "./processors/SourceLinkProcessor";
import LivePreviewLinkProcessor from "./processors/LivePreviewLinkProcessor";
import {EditorView, ViewPlugin} from "@codemirror/view";
import {createViewPluginClass, MarkPlugin} from "./cm6-widget/MarkPlugin";
import {EditorSelection} from "@codemirror/state";
import LivePreviewRegexProcessor from "./processors/LivePreviewRegexProcessor";

enum VIEW_MODE {
    SOURCE,
    PREVIEW,
    LIVE_PREVIEW
}

export default class JumpToLink extends Plugin {
    isLinkHintActive: boolean = false;
    settings: Settings;
    prefixInfo: { prefix: string, shiftKey: boolean } | undefined = undefined;
    markPlugin: MarkPlugin
    markViewPlugin: ViewPlugin<any>

    async onload() {
        this.settings = await this.loadData() || new Settings();

        this.addSettingTab(new SettingTab(this.app, this));

        const markPlugin = this.markPlugin = new MarkPlugin([]);

        const markViewPlugin = this.markViewPlugin = ViewPlugin.fromClass(createViewPluginClass(markPlugin), {
            decorations: v => v.decorations
        });
        this.registerEditorExtension([markViewPlugin])

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
    }

    onunload() {
        console.log('unloading jump to links plugin');
    }

    action(type: 'link' | 'regexp') {
        if (this.isLinkHintActive) {
            return;
        }

        switch (type) {
            case "link":
                this.handleJumpToLink();
                return
            case "regexp":
                this.handleJumpToRegex();
                return
        }
    }

    getMode(currentView: View): VIEW_MODE {
        if (currentView.getState().mode === 'preview') {
            return VIEW_MODE.PREVIEW;
        } else if ((<{ editMode?: { sourceMode: boolean } }>currentView)?.editMode?.sourceMode === false) {
            return VIEW_MODE.LIVE_PREVIEW;
        } else if (currentView.getState().mode === 'source') {
            return VIEW_MODE.SOURCE;
        }

        return VIEW_MODE.SOURCE;
    }

    handleJumpToLink = () => {
        const {settings: {letters}, app} = this

        const currentView = app.workspace.activeLeaf.view;
        const mode = this.getMode(currentView);

        switch (mode) {
            case VIEW_MODE.SOURCE:
                const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;
                const sourceLinkHints = new SourceLinkProcessor(cmEditor, letters).init();
                this.handleActions(sourceLinkHints, cmEditor);
                break;
            case VIEW_MODE.PREVIEW:
                const previewViewEl: HTMLElement = (currentView as any).previewMode.containerEl.querySelector('div.markdown-preview-view');
                const previewLinkHints = new PreviewLinkProcessor(previewViewEl, letters).init();
                this.handleActions(previewLinkHints);
                break;
            case VIEW_MODE.LIVE_PREVIEW:
                const cm6Editor: EditorView = (<{ editor?: { cm: EditorView } }>currentView).editor.cm;
                const livePreviewLinks = new LivePreviewLinkProcessor(cm6Editor, letters).init();
                this.markPlugin.setLinks(livePreviewLinks);
                this.app.workspace.updateOptions();
                this.handleActions(livePreviewLinks);
                break;
        }
    }

    handleJumpToRegex = () => {
        const {app, settings: {letters, jumpToAnywhereRegex}} = this
        const currentView = app.workspace.activeLeaf.view;
        const mode = this.getMode(currentView);

        switch (mode) {
            case VIEW_MODE.LIVE_PREVIEW:
                const cm6Editor: EditorView = (<{ editor?: { cm: EditorView } }>currentView).editor.cm;
                const livePreviewLinks = new LivePreviewRegexProcessor(cm6Editor, letters, jumpToAnywhereRegex).init();
                this.markPlugin.setLinks(livePreviewLinks);
                this.app.workspace.updateOptions();
                this.handleActions(livePreviewLinks, cm6Editor);
                break;
            case VIEW_MODE.PREVIEW:
                break;
            case VIEW_MODE.SOURCE:
                const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;
                const links = new RegexpProcessor(cmEditor, jumpToAnywhereRegex, letters).init();
                this.handleActions(links, cmEditor);
                break;
            default:
                break;
        }

    }

    handleActions = (linkHints: LinkHintBase[], cmEditor?: Editor | EditorView): void => {
        if (!linkHints.length) {
            return;
        }

        const linkHintMap: { [letter: string]: LinkHintBase } = {};
        linkHints.forEach(x => linkHintMap[x.letter] = x);

        const handleHotkey = (newLeaf: boolean, link: SourceLinkHint | LinkHintBase) => {
            if (link.type === 'internal') {
                // not sure why the second argument in openLinkText is necessary.
                this.app.workspace.openLinkText(decodeURI(link.linkText), '', newLeaf, {active: true});
            } else if (link.type === 'external') {
                // todo
                require('electron').shell.openExternal(link.linkText);
            } else {
                const editor = cmEditor;
                if (editor instanceof EditorView) {
                    const index = (link as SourceLinkHint).index;
                    editor.dispatch({ selection: EditorSelection.cursor(index) })
                } else {
                    editor.setCursor(editor.posFromIndex((<SourceLinkHint>link).index));
                }
            }
        }

        const removePopovers = () => {
            document.removeEventListener('click', removePopovers)
            document.querySelectorAll('.jl.popover').forEach(e => e.remove());
            document.querySelectorAll('#jl-modal').forEach(e => e.remove());
            this.prefixInfo = undefined;
            this.markPlugin.clean();
            this.app.workspace.updateOptions();
            this.isLinkHintActive = false;
        }

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Shift') {
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

                    return;
                }
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const newLeaf = this.prefixInfo?.shiftKey || event.shiftKey;

            linkHint && handleHotkey(newLeaf, linkHint);

            document.removeEventListener('keydown', handleKeyDown);
            removePopovers();
        };

        document.addEventListener('click', removePopovers)
        document.addEventListener('keydown', handleKeyDown);
        this.isLinkHintActive = true;
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

        /* Modal mode deprecated */
        // new Setting(containerEl)
        //     .setName('Presentation')
        //     .setDesc('How to show links')
        //     .addDropdown(cb => { cb
        //         .addOptions({
        //             "popovers": 'Popovers',
        //             "modal": 'Modal'
        //         })
        //         .setValue(this.plugin.settings.mode)
        //         .onChange((value: LinkHintMode) => {
        //             this.plugin.settings.mode = value;
        //             this.plugin.saveData(this.plugin.settings);
        //         })
        //     });

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
    }
}
