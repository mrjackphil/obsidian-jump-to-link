import {App, Plugin, PluginSettingTab, Setting} from 'obsidian';
import { Editor } from 'codemirror';
import { LinkHintBase, LinkHintType, PreviewLinkHint, Settings, SourceLinkHint } from 'types';

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
            callback: this.handleJumpToLink,
            hotkeys: [{modifiers: ['Ctrl'], key: '\''}]
        });

        this.addCommand({
            id: "activate-jump-to-anywhere",
            name: "Jump to Anywhere Regex",
            callback: this.handleJumpToRegex,
            hotkeys: [{ modifiers: ["Ctrl"], key: ";" }],
        });
    }

    onunload() {
        console.log('unloading jump to links plugin');
    }

    handleJumpToLink = () => {
        if (this.isLinkHintActive) {
            return;
        }

        const currentView = this.app.workspace.activeLeaf.view;

        if (currentView.getState().mode === 'preview') {
            const previewViewEl: HTMLElement = (currentView as any).previewMode.containerEl.querySelector('div.markdown-preview-view');
            this.managePreviewLinkHints(previewViewEl);
        } else if (currentView.getState().mode === 'source') {
            const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;
            this.manageSourceLinkHints(cmEditor);
        }
    }

    handleJumpToRegex = () => {
        const currentView = this.app.workspace.activeLeaf.view;

        if (this.isLinkHintActive || currentView.getState().mode !== "source") {
            return;
        }

        const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;
        this.manageSourceLinkHints(cmEditor, "regex");
    }

    managePreviewLinkHints = (previewViewEl: HTMLElement): void => {
        const linkHints = this.getPreviewLinkHints(previewViewEl);
        if (linkHints.length) {
            this.displayPreviewPopovers(previewViewEl, linkHints);
            this.activateLinkHints(linkHints);
        }
    }

    manageSourceLinkHints = (cmEditor: Editor, mode = "link"): void => {
        const linkHints = (mode === "link" ? this.getSourceLinkHints(cmEditor) : this.getRegexLinkHints(cmEditor));
        if (linkHints.length) {
            this.displaySourcePopovers(cmEditor, linkHints);
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

    checkIsPreviewElOnScreen(parent: HTMLElement, el: HTMLElement) {
        return el.offsetTop < parent.scrollTop || el.offsetTop > parent.scrollTop + parent.offsetHeight
    }

    getPreviewLinkHints = (previewViewEl: HTMLElement): PreviewLinkHint[] => {
        const {checkIsPreviewElOnScreen} = this
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
                ? anchorEl.dataset['href']
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

        const linkHintLetters = this.getLinkHintLetters(sortedLinkHints.length);

        sortedLinkHints.forEach((linkHint, i) => {
            linkHint.letter = linkHintLetters[i];
        });

        return sortedLinkHints;
    }

    getVisibleLineText(cmEditor: Editor) {
        // Grab only visible lines
        const scrollInfo = cmEditor.getScrollInfo();
        const { line: from } = cmEditor.coordsChar({ left: 0, top: 0 }, 'page');
        const { line: to } = cmEditor.coordsChar({ left: scrollInfo.left, top: scrollInfo.top + scrollInfo.height})
        const indOffset = cmEditor.indexFromPos({ch:0, line: from})
        const strs = cmEditor.getRange({ch: 0, line: from}, {ch: 0, line: to + 1})

        return { indOffset, strs };
    }

    getRegexLinkHints = (cmEditor: Editor): SourceLinkHint[] => {
        const regExUrl = new RegExp(this.settings.jumpToAnywhereRegex, 'g');

        let linksWithIndex: {
            index: number;
            type: "regex";
            linkText: string;
        }[] = [];

        const { indOffset, strs } = this.getVisibleLineText(cmEditor);

        let regExResult;

        while ((regExResult = regExUrl.exec(strs))) {
            const linkText = regExResult[1];
            linksWithIndex.push({
                index: regExResult.index + indOffset,
                type: "regex",
                linkText,
            });
        }

        const linkHintLetters = this.getLinkHintLetters(linksWithIndex.length);

        const linksWithLetter: SourceLinkHint[] = [];
        linksWithIndex
            .sort((x, y) => x.index - y.index)
            .forEach((linkHint, i) => {
                linksWithLetter.push({
                    letter: linkHintLetters[i],
                    ...linkHint,
                });
            });

        return linksWithLetter;
    };

    getSourceLinkHints = (cmEditor: Editor): SourceLinkHint[] => {
        // expecting either [[Link]] or [[Link|Title]]
        const regExInternal = /\[\[(.+?)(\|.+?)?]]/g;
        // expecting [Title](../example.md)
        const regExMdInternal = /\[.+?]\(((\.\.|\w|\d).+?)\)/g;
        // expecting [Title](file://link) or [Title](https://link)
        const regExExternal = /\[.+?]\(((https?:|file:).+?)\)/g;
        // expecting http://hogehoge or https://hogehoge
        const regExUrl = /(?<= |\n|^)(https?:\/\/[^ \n]+)/g;

        const { indOffset, strs } = this.getVisibleLineText(cmEditor);

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

        const linkHintLetters = this.getLinkHintLetters(linksWithIndex.length);

        const linksWithLetter: SourceLinkHint[] = [];
        linksWithIndex
            .sort((x,y) => x.index - y.index)
            .forEach((linkHint, i) => {
                linksWithLetter.push({ letter: linkHintLetters[i], ...linkHint});
            });

        return linksWithLetter;
    }

    getLinkHintLetters = (numLinkHints: number): string[] => {
        const alphabet = this.settings.letters.toUpperCase()

        let prefixCount = Math.ceil((numLinkHints - alphabet.length) / (alphabet.length - 1))

        // ensure 0 <= prefixCount <= alphabet.length
        prefixCount = Math.max(prefixCount, 0);
        prefixCount = Math.min(prefixCount, alphabet.length);

        const prefixes = ['', ...Array.from(alphabet.slice(0, prefixCount))];

        const linkHintLetters = []
        for (let i = 0; i < prefixes.length; i++) {
            const prefix = prefixes[i]
            for (let j = 0; j < alphabet.length; j++) {
                if (linkHintLetters.length < numLinkHints) {
                    const letter = alphabet[j];
                    if (prefix === '') {
                        if (!prefixes.contains(letter)) {
                            linkHintLetters.push(letter);
                        }
                    } else {
                        linkHintLetters.push(prefix + letter)
                    }
                } else {
                    break;
                }
            }
        }

        return linkHintLetters;
    }

    displayPreviewPopovers = (markdownPreviewViewEl: HTMLElement, linkHints: PreviewLinkHint[]): void => {
        for (let linkHint of linkHints) {
            const linkHintEl = markdownPreviewViewEl.createEl('div');
            linkHintEl.style.top = linkHint.top + 'px';
            linkHintEl.style.left = linkHint.left + 'px';

            linkHintEl.textContent = linkHint.letter;
            linkHintEl.classList.add('jl');
            linkHintEl.classList.add('popover');
        }
    }

    displaySourcePopovers = (cmEditor: Editor, linkKeyMap: SourceLinkHint[]): void => {
        const createWidgetElement = (content: string) => {
            const linkHintEl = document.createElement('div');
            linkHintEl.classList.add('jl');
            linkHintEl.classList.add('popover');
            linkHintEl.innerHTML = content;
            return linkHintEl;
        }

        const drawWidget = (cmEditor: Editor, linkHint: SourceLinkHint) => {
            const pos = cmEditor.posFromIndex(linkHint.index);
            // the fourth parameter is undocumented. it specifies where the widget should be place
            return (cmEditor as any).addWidget(pos, createWidgetElement(linkHint.letter), false, 'over');
        }

        linkKeyMap.forEach(x => drawWidget(cmEditor, x));
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
