import {App, Plugin, PluginSettingTab, Setting, View} from 'obsidian';
import { Editor } from 'codemirror';
import { LinkHintBase, Settings, SourceLinkHint } from 'types';
import {displaySourcePopovers, getLinkHintLetters, getVisibleLineText} from "./common";
import RegexpProcessor from "./Processors/RegexpProcessor";
import PreviewLinkProcessor from "./Processors/PreviewLinkProcessor";

enum VIEW_MODE {
    SOURCE,
    PREVIEW,
    LIVE_PREVIEW
}

export default class JumpToLink extends Plugin {
    isLinkHintActive: boolean = false;
    settings: Settings;
    prefixInfo: { prefix: string, shiftKey: boolean } | undefined = undefined;

    async onload() {
        this.settings = await this.loadData() || new Settings();

        this.addSettingTab(new SettingTab(this.app, this));

        this.addCommand({
            id: 'activate-jump-to-link',
            name: 'Jump to Link',
            callback: this.action.bind(this, 'link'),
            hotkeys: [{modifiers: ['Ctrl'], key: '\''}]
        });

        this.addCommand({
            id: "activate-jump-to-anywhere",
            name: "Jump to Anywhere Regex",
            callback: this.action.bind(this, 'regexp'),
            hotkeys: [{ modifiers: ["Ctrl"], key: ";" }],
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
        } else if (currentView.getState().mode === 'source') {
            return VIEW_MODE.SOURCE;
        }

        return VIEW_MODE.SOURCE;
    }

    handleJumpToLink = () => {
        const { settings: { letters }, app } = this

        const currentView = app.workspace.activeLeaf.view;
        const mode = this.getMode(currentView);

        switch (mode) {
            case VIEW_MODE.SOURCE:
                const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;
                this.manageSourceLinkHints(cmEditor);
                return
            case VIEW_MODE.PREVIEW:
                const previewViewEl: HTMLElement = (currentView as any).previewMode.containerEl.querySelector('div.markdown-preview-view');
                new PreviewLinkProcessor(previewViewEl, letters).init(this.activateLinkHints);
                return
            case VIEW_MODE.LIVE_PREVIEW:
                return
        }
    }

    handleJumpToRegex = () => {
        const { app, isLinkHintActive, settings: { letters, jumpToAnywhereRegex } } = this
        const currentView = app.workspace.activeLeaf.view;
        const mode = this.getMode(currentView);

        if (isLinkHintActive || mode !== VIEW_MODE.SOURCE) {
            return;
        }

        const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;

        new RegexpProcessor(cmEditor, jumpToAnywhereRegex, letters).init(this.activateLinkHints);
    }

    manageSourceLinkHints = (cmEditor: Editor): void => {
        const linkHints = this.getSourceLinkHints(cmEditor)
        if (linkHints.length) {
            displaySourcePopovers(cmEditor, linkHints);
            this.activateLinkHints(linkHints, cmEditor);
        }
    };

    activateLinkHints = (linkHints: LinkHintBase[], cmEditor?: Editor): void => {
        const linkHintMap: { [letter: string]: LinkHintBase } = {};
        linkHints.forEach(x => linkHintMap[x.letter] = x);

        const handleHotkey = (newLeaf: boolean, link: SourceLinkHint | LinkHintBase) => {
            if (link.type === 'internal') {
                // not sure why the second argument in openLinkText is necessary.
                this.app.workspace.openLinkText(decodeURI(link.linkText), '', newLeaf, { active: true });
            } else if (link.type === 'external') {
                // todo
                require('electron').shell.openExternal(link.linkText);
            } else {
                const editor = cmEditor;
                editor.setCursor(editor.posFromIndex((<SourceLinkHint>link).index));
            }
        }

        const removePopovers = () => {
            document.removeEventListener('click', removePopovers)
            document.querySelectorAll('.jl.popover').forEach(e => e.remove());
            document.querySelectorAll('#jl-modal').forEach(e => e.remove());
            this.prefixInfo = undefined;
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
                    this.prefixInfo = { prefix: eventKey, shiftKey: event.shiftKey };

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

    getSourceLinkHints = (cmEditor: Editor): SourceLinkHint[] => {
        const { settings: { letters } } = this
        // expecting either [[Link]] or [[Link|Title]]
        const regExInternal = /\[\[(.+?)(\|.+?)?]]/g;
        // expecting [Title](../example.md)
        const regExMdInternal = /\[.+?]\(((\.\.|\w|\d).+?)\)/g;
        // expecting [Title](file://link) or [Title](https://link)
        const regExExternal = /\[.+?]\(((https?:|file:).+?)\)/g;
        // expecting http://hogehoge or https://hogehoge
        const regExUrl = /(?<= |\n|^)(https?:\/\/[^ \n]+)/g;

        const { indOffset, strs } = getVisibleLineText(cmEditor);

        let linksWithIndex: { index: number, type: 'internal' | 'external', linkText: string }[] = [];
        let regExResult;

        while(regExResult = regExInternal.exec(strs)) {
            const linkText = regExResult[1];
            linksWithIndex.push({ index: regExResult.index + indOffset, type: 'internal', linkText });
        }

        while(regExResult = regExMdInternal.exec(strs)) {
            const linkText = regExResult[1];
            linksWithIndex.push({ index: regExResult.index + indOffset, type: 'internal', linkText });
        }

        while(regExResult = regExExternal.exec(strs)) {
            const linkText = regExResult[1];
            linksWithIndex.push({ index: regExResult.index + indOffset, type: 'external', linkText })
        }

        while(regExResult = regExUrl.exec(strs)) {
            const linkText = regExResult[1];
            linksWithIndex.push({ index: regExResult.index + indOffset, type: 'external', linkText })
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
