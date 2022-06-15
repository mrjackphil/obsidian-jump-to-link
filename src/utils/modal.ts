import {LinkHintBase} from "../../types";

export function displayModal(linkHints: LinkHintBase[]): void {
    const modalEl = activeDocument.createElement('div');
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
    activeDocument.body.appendChild(modalEl);

    const linkEl = (content: string) => {
        const el = activeDocument.createElement('div');
        el.innerHTML = content;
        return el;
    };

    const modalContentEl = modalEl.querySelector('.modal-content');
    linkHints.forEach((linkHint: LinkHintBase) =>
        modalContentEl.appendChild(linkEl(linkHint.letter + ' ' + linkHint.linkText))
    );
}
