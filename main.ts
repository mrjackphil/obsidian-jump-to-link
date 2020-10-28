import {
	App,
	DropdownComponent,
	MarkdownSourceView,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';
import {drawLinks, drawPopovers, getUrlsFromText} from "./helper";

export default class JumpToLink extends Plugin {
	modal = undefined as HTMLElement || undefined
	cancel = undefined as (ev: any) => void || undefined
	mode: 'popovers' | 'modal' = 'popovers'

	onInit() {

	}

	onload() {
	    this.initHotkey = this.initHotkey.bind(this)
		console.log('loading plugin');

		this.addRibbonIcon('dice', 'Sample Plugin', () => {
			new Notice('This is a notice!');
		});

		this.addStatusBarItem().setText('Status Bar Text');

		this.addCommand({
			id: 'jump-link',
			name: 'Open Sample Modal',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						new SampleModal(this.app).open();
					}
					return true;
				}
				return false;
			}
		});

		this.addSettingTab(new SettingTab(this.app, this));

		document.addEventListener('keydown', this.initHotkey);
	}

	onunload() {
		console.log('unloading plugin');
		document.removeEventListener('keydown', this.initHotkey);
		console.log('Plugin is off');
	}

	initHotkey(ev: KeyboardEvent) {
		const currentView = this.app.workspace.activeLeaf.view

		let cmInst = null as CodeMirror.Editor || null

		if (currentView instanceof MarkdownView) {
			cmInst = currentView.sourceMode.cmEditor
		}

		const {modal} = this;

		if (ev.key === '\'' && ev.ctrlKey && !modal && cmInst) {
			const urls = getUrlsFromText(cmInst);
			const {app} = this;
			console.log('triggered')

			this.showJumpLetters(app, urls, cmInst)
		}
	}

	showJumpLetters(app: App, array: [number, string][], cmInst: CodeMirror.Editor) {
		const hotkeys = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ';
		const hotkeyAr = array.map( (e, i) => [i, hotkeys[i]] ) as [number, string][];

		const handleHotkey = (i: number) => {
			const pos = cmInst.posFromIndex(array[i][0] + 2);

			cmInst.setCursor(pos);
			// @ts-ignore
			setTimeout(() => app.commands.executeCommandById('editor:follow-link'), 100);
		}

		if (this.mode === 'popovers') {
			drawPopovers(array, hotkeyAr, cmInst);
		}

		if (this.mode === 'modal') {
			drawLinks(array, hotkeyAr);
		}

		this.cancel = (ev) => {
			const h = hotkeyAr.filter(e => e[1] === ev.key);
			ev.preventDefault();
			ev.stopPropagation();
			ev.stopImmediatePropagation();

			h.length && handleHotkey(h[0][0]);

			document.removeEventListener('keydown', this.cancel);
			document.querySelectorAll('.jl.popover').forEach(e => e.remove());
			document.querySelectorAll('#mrj-modal').forEach(e => e.remove());
			this.modal?.remove();
			this.modal = null;
		};

		document.addEventListener('keydown', this.cancel);

		return hotkeyAr;
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
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
			.setName('Presentation')
			.setDesc('How to show links')
			.addDropdown(cb => {
				cb.addOptions({
					"popovers": 'Popovers',
					"modal": 'Modal'
				}).onChange((value: 'popovers' | 'modal') => this.plugin.mode = value)
			})
	}
}
