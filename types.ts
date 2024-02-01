export type LinkHintType = 'internal' | 'external' | 'regex';

export interface LinkHintBase {
	letter: string;
	type: LinkHintType;
	linkText: string;
}

export interface PreviewLinkHint extends LinkHintBase {
	linkElement: HTMLElement
	left: number;
	top: number;
}

export interface SourceLinkHint extends LinkHintBase {
	index: number
}

export class Settings {
	// Defaults as in Vimium extension for browsers
	letters: string = 'sadfjklewcmpgh';
	jumpToAnywhereRegex: string = '\\b\\w{3,}\\b';
	lightspeedCaseSensitive: boolean = false;
	jumpToLinkIfOneLinkOnly: boolean = true;
}

export class Processor {
	letters: string;

	public init: () => LinkHintBase[];
}
