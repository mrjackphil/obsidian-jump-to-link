import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Editor } from 'codemirror';
import { LinkHintBase, LinkHintMode, LinkHintType, PreviewLinkHint, Settings, SourceLinkHint } from 'types';

export default class JumpToLink extends Plugin {
	isLinkHintActive: boolean = false;
	settings: Settings;

	async onload() {
		console.log('loading plugin');

		this.settings = await this.loadData() || new Settings();

		this.addSettingTab(new SettingTab(this.app, this));

		document.addEventListener('keydown', this.handleKeyDown);
	}

	onunload() {
		console.log('unloading plugin');
		document.removeEventListener('keydown', this.handleKeyDown);
		console.log('Plugin is off');
	}

	handleKeyDown = (event: KeyboardEvent) => {
		if (this.isLinkHintActive) {
			return;
		}

		const currentView = this.app.workspace.activeLeaf.view;

		if (event.key == '\'' && event.ctrlKey) {
			if (currentView.getState().mode === 'preview') {
				const previewViewEl: HTMLElement = (currentView as any).previewMode.containerEl.querySelector('div.markdown-preview-view');
				this.managePreviewLinkHints(previewViewEl);
			} else if (currentView.getState().mode === 'source') {
				const cmEditor: Editor = (currentView as any).sourceMode.cmEditor;
				this.manageSourceLinkHints(cmEditor);
			}
		}
	};

	managePreviewLinkHints = (previewViewEl: HTMLElement): void => {
		const linkHints = this.getPreviewLinkHints(previewViewEl);
		if (linkHints.length) {
			if (this.settings.mode === 'modal') {
				this.displayModal(linkHints);
			} else if (this.settings.mode === 'popovers') {
				this.displayPreviewPopovers(previewViewEl, linkHints);
			}
			this.activateLinkHints(linkHints);
		}
	}

	manageSourceLinkHints = (cmEditor: Editor): void => {
		const linkHints = this.getSourceLinkHints(cmEditor);
		if (linkHints.length) {
			if (this.settings.mode === 'modal') {
				this.displayModal(linkHints);
			} else if (this.settings.mode === 'popovers') {
				this.displaySourcePopovers(cmEditor, linkHints);
			}
			this.activateLinkHints(linkHints);
		}
	};

	activateLinkHints = (linkHints: LinkHintBase[]): void => {
		const linkHintMap: { [letter: string]: LinkHintBase } = {};
		linkHints.forEach(x => linkHintMap[x.letter] = x);

		const handleHotkey = (event: KeyboardEvent, link: LinkHintBase) => {
			if (link.type === 'internal') {
				const newLeaf = event.shiftKey;
				// not sure why the second argument in openLinkText is necessary.
				this.app.workspace.openLinkText(link.linkText, '', newLeaf, { active: true });
			} else if (link.type === 'external') {
				// todo
				require('electron').shell.openExternal(link.linkText);
			}
		}

		const cancel = (event: KeyboardEvent): void => {
			if (event.key === 'Shift') {
				return;
			}
			const linkHint = linkHintMap[event.key.toUpperCase()];
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();

			linkHint && handleHotkey(event, linkHint);

			document.removeEventListener('keydown', cancel);
			document.querySelectorAll('.jl.popover').forEach(e => e.remove());
			document.querySelectorAll('#jl-modal').forEach(e => e.remove());
			this.isLinkHintActive = false;
		};

		document.addEventListener('keydown', cancel);
		this.isLinkHintActive = true;
	}

	getPreviewLinkHints = (previewViewEl: HTMLElement): PreviewLinkHint[] => {
		const alphabet: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

		const links = previewViewEl.querySelectorAll('a');

		const linkHints: PreviewLinkHint[] = [];
		links.forEach((anchorEl, i) => {
			const linkType: LinkHintType = anchorEl.hasClass('internal-link') 
				? 'internal'
				: 'external';

			const linkText = linkType === 'internal'
				? anchorEl.dataset['href']
				: anchorEl.href;

			linkHints.push({
				letter: alphabet[i],
				linkText: linkText,
				type: linkType,
				left: anchorEl.offsetLeft,
				top: anchorEl.offsetTop,
			});
		});

		return linkHints;
	}
	
	getSourceLinkHints = (cmEditor: Editor): SourceLinkHint[] => {
		const alphabet: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

		// expecting either [[Link]] or [[Link|Title]]
		const regExInternal = /\[\[(.+?)(\|.+?)?\]\]/g;
		// expecting [Title](link)
		const regExExternal = /\[.+?\]\((.+?)\)/g;

		const strs = cmEditor.getValue();

		let linksWithIndex: { index: number, type: 'internal' | 'external', linkText: string }[] = [];
		let regExResult;

		while(regExResult = regExInternal.exec(strs)) {
			const linkText = regExResult[1];
			linksWithIndex.push({ index: regExResult.index, type: 'internal', linkText });
		}
		
		while(regExResult = regExExternal.exec(strs)) {
			const linkText = regExResult[1];
			linksWithIndex.push({ index: regExResult.index, type: 'external', linkText })
		}

		const linksWithLetter: SourceLinkHint[] = [];

		linksWithIndex
			.sort((x,y) => x.index - y.index)
			.forEach((x, i) => {
				linksWithLetter.push({ letter: alphabet[i], ...x});
			});

		return linksWithLetter;
	}

	displayModal = (linkHints: LinkHintBase[]): void => {
		const modalEl = document.createElement('div');
		modalEl.innerHTML =  `
			<div class="modal-container" id="jl-modal">
				<div class="modal-bg"></div>
				<div class="modal">
					<div class="modal-close-button"></div>
					<div class="modal-title">Jump to links</div>
					<div class="modal-content"></div>
				</div>
			</div>
		`;
		modalEl.querySelector('.modal-close-button').addEventListener('click', modalEl.remove);
		document.body.appendChild(modalEl);

		const linkEl = (content: string) => {
			const el = document.createElement('div');
			el.innerHTML = content;
			return el;
		};

		const modalContentEl = modalEl.querySelector('.modal-content');
		linkHints.forEach((linkHint: LinkHintBase) =>
			modalContentEl.appendChild(linkEl(linkHint.letter + ' ' + linkHint.linkText))
		);
	}

	displayPreviewPopovers = (markdownPreviewViewEl: HTMLElement, linkHints: PreviewLinkHint[]): void => {
		for (var linkHint of linkHints) {
			const linkHintEl = markdownPreviewViewEl.createEl('div');
			linkHintEl.style.top = linkHint.top + 'px';
			linkHintEl.style.left = linkHint.left + 'px';

			linkHintEl.textContent = linkHint.letter;
			linkHintEl.addClass('jl');
			linkHintEl.addClass('popover');
		}
	}

	displaySourcePopovers = (cmEditor: Editor, linkKeyMap: SourceLinkHint[]): void => {
		const createWidgetElement = (content: string) => {
			const linkHintEl = document.createElement('div');
			linkHintEl.addClass('jl');
			linkHintEl.addClass('popover');
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

		new Setting(containerEl)
			.setName('Presentation')
			.setDesc('How to show links')
			.addDropdown(cb => { cb
				.addOptions({
					"popovers": 'Popovers',
					"modal": 'Modal'
				})
				.setValue(this.plugin.settings.mode)
				.onChange((value: LinkHintMode) => {
					this.plugin.settings.mode = value;
					this.plugin.saveData(this.plugin.settings);
				})
			});
	}
}
