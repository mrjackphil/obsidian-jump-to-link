import {App, MarkdownView, Plugin, PluginSettingTab, Setting, View} from 'obsidian';
import {Editor} from 'codemirror';
import {EditorSelection} from "@codemirror/state";
import {EditorView, ViewPlugin} from "@codemirror/view";
import {LinkHintBase, Settings, SourceLinkHint} from 'types';
import {createViewPluginClass, MarkPlugin} from "./cm6-widget/MarkPlugin";

import CM6LinkProcessor from "./processors/CM6LinkProcessor";
import CM6RegexProcessor from "./processors/CM6RegexProcessor";
import LegacyRegexpProcessor from "./processors/LegacyRegexpProcessor";
import LegacySourceLinkProcessor from "./processors/LegacySourceLinkProcessor";
import PreviewLinkProcessor from "./processors/PreviewLinkProcessor";

enum VIEW_MODE {
    SOURCE,
    PREVIEW,
    LEGACY
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
            return VIEW_MODE.SOURCE;
        }

    }

    handleJumpToLink = () => {
        const {settings: {letters}, app} = this

        const currentView = app.workspace.getLeaf(false).view;
        const mode = this.getMode(currentView);

        switch (mode) {
            case VIEW_MODE.LEGACY:
                const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;
                const sourceLinkHints = new LegacySourceLinkProcessor(cmEditor, letters).init();
                this.handleActions(sourceLinkHints, cmEditor);
                break;
            case VIEW_MODE.PREVIEW:
                const previewViewEl: HTMLElement = (currentView as any).previewMode.containerEl.querySelector('div.markdown-preview-view');
                const previewLinkHints = new PreviewLinkProcessor(previewViewEl, letters).init();
                this.handleActions(previewLinkHints);
                break;
            case VIEW_MODE.SOURCE:
                const cm6Editor: EditorView = (<{ editor?: { cm: EditorView } }>currentView).editor.cm;
                const livePreviewLinks = new CM6LinkProcessor(cm6Editor, letters).init();
                this.markPlugin.setLinks(livePreviewLinks);
                this.app.workspace.updateOptions();
                this.handleActions(livePreviewLinks);
                break;
        }
    }

    handleJumpToRegex = (stringToSearch?: string) => {
        const {app, settings: {letters, jumpToAnywhereRegex}} = this
        const currentView = app.workspace.getLeaf(false).view
        const mode = this.getMode(currentView);
        const whatToLookAt = stringToSearch || jumpToAnywhereRegex;

        switch (mode) {
            case VIEW_MODE.SOURCE:
                const cm6Editor: EditorView = (<{ editor?: { cm: EditorView } }>currentView).editor.cm;
                const livePreviewLinks = new CM6RegexProcessor(cm6Editor, letters, whatToLookAt).init();
                this.markPlugin.setLinks(livePreviewLinks);
                this.app.workspace.updateOptions();
                this.handleActions(livePreviewLinks, cm6Editor);
                break;
            case VIEW_MODE.PREVIEW:
                break;
            case VIEW_MODE.LEGACY:
                const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;
                const links = new LegacyRegexpProcessor(cmEditor, whatToLookAt, letters).init();
                this.handleActions(links, cmEditor);
                break;
            default:
                break;
        }

    }
    // adapted from: https://github.com/mrjackphil/obsidian-jump-to-link/issues/35#issuecomment-1085905668
    handleLightspeedJump() {
        // get all text color
        const { contentEl } = app.workspace.getActiveViewOfType(MarkdownView)
        if (!contentEl) {return}
        const contentContainerColor = contentEl.getElementsByClassName("cm-contentContainer");
        const originalColor = contentContainerColor[0].style.color;
        // change all text color to gray
        contentContainerColor[0].style.color = 'var(--jump-to-link-lightspeed-color)';

        const keyArray = []
        const grabKey = (event) => {
            event.preventDefault();
            // handle Escape to reject the mode
            if (event.key === 'Escape') {
                document.removeEventListener("keydown", grabKey, { capture: true })
            }

            // test if keypress is capitalized
            if (/^[a-z]$/i.test(event.key)) {
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
                this.handleJumpToRegex("\\b" + keyArray.join(""));
                // removing eventListener after proceeded
                document.removeEventListener("keydown", grabKey, { capture: true })
                contentContainerColor[0].style.color = originalColor;
            }
        }
        document.addEventListener('keydown', grabKey, { capture: true });
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
                window.open(link.linkText);
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

            document.removeEventListener('keydown', handleKeyDown, { capture: true });
            removePopovers();
        };

        document.addEventListener('click', removePopovers)
        document.addEventListener('keydown', handleKeyDown, { capture: true });
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
