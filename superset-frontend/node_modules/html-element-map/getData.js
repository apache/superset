'use strict';

var map = function (arr, mapper) {
	var mapped = [];
	for (var i = 0; i < arr.length; i += 1) {
		mapped.push(mapper(arr[i], i));
	}
	return mapped;
};

var expecteds = [
	['HTMLElement', 'article'],
	['HTMLElement', 'section'],
	['HTMLBaseFontElement', 'basefont'],
	['HTMLPhraseElement', 'cite'],
	['HTMLElement', 'noscript'],
	['HTMLBGSoundElement', 'bgsound'],
	['HTMLPhraseElement', 'blink'],
	['HTMLElement', 'multicol'],
	['HTMLNextIdElement', 'nextid'],
	['HTMLElement', 'rb'],
	['HTMLElement', 'spacer'],
	['HTMLAnchorElement', 'a'],
	// ['HTMLAppletElement', 'applet'], // commented out due to IE 11 java update popup
	['HTMLAreaElement', 'area'],
	['HTMLAudioElement', 'audio'],
	['HTMLBaseElement', 'base'],
	['HTMLBodyElement', 'body'],
	['HTMLBRElement', 'br'],
	['HTMLButtonElement', 'button'],
	['HTMLCanvasElement', 'canvas'],
	['HTMLContentElement', 'content'],
	['HTMLDataElement', 'data'],
	['HTMLDataListElement', 'datalist'],
	['HTMLDialogElement', 'dialog'],
	['HTMLDirectoryElement', 'dir'],
	['HTMLDivElement', 'div'],
	['HTMLDListElement', 'dl'],
	['HTMLEmbedElement', 'embed'],
	['HTMLFieldSetElement', 'fieldset'],
	['HTMLFontElement', 'font'],
	['HTMLFormElement', 'form'],
	['HTMLFrameElement', 'frame'],
	['HTMLFrameSetElement', 'frameset'],
	['HTMLHeadElement', 'head'],
	['HTMLHeadingElement', 'h1'],
	['HTMLHeadingElement', 'h2'],
	['HTMLHeadingElement', 'h3'],
	['HTMLHeadingElement', 'h4'],
	['HTMLHeadingElement', 'h5'],
	['HTMLHeadingElement', 'h6'],
	['HTMLHtmlElement', 'html'],
	['HTMLHRElement', 'hr'],
	['HTMLIFrameElement', 'iframe'],
	['HTMLImageElement', 'img'],
	['HTMLInputElement', 'input'],
	['HTMLIsIndexElement', 'index'], // in HTML5, this is HTMLUnknownElement
	['HTMLKeygenElement', 'keygen', 'HTMLBlockElement'],
	['HTMLLabelElement', 'label'],
	['HTMLLegendElement', 'legend'],
	['HTMLLIElement', 'li'],
	['HTMLLinkElement', 'link'],
	['HTMLElement', 'main'], // in IE 9-11, this is HTMLUnknownElement
	['HTMLMapElement', 'map'],
	['HTMLMarqueeElement', 'marquee'],
	['HTMLMenuElement', 'menu'],
	['HTMLMetaElement', 'meta'],
	['HTMLMeterElement', 'meter'],
	['HTMLModElement', 'del'],
	['HTMLModElement', 'ins'],
	['HTMLObjectElement', 'object'],
	['HTMLOListElement', 'ol'],
	['HTMLOptGroupElement', 'optgroup'],
	['HTMLOptionElement', 'option'],
	['HTMLOutputElement', 'output'],
	['HTMLParagraphElement', 'p'],
	['HTMLParamElement', 'param'],
	['HTMLPictureElement', 'picture'],
	['HTMLPreElement', 'pre'],
	['HTMLProgressElement', 'progress'],
	['HTMLQuoteElement', 'q'],
	['HTMLQuoteElement', 'blockquote', 'HTMLBlockElement'],
	['HTMLScriptElement', 'script'],
	['HTMLPictureElement', 'picture'],
	['HTMLSelectElement', 'select'],
	['HTMLShadowElement', 'shadow'],
	['HTMLSourceElement', 'source'],
	['HTMLSpanElement', 'span'],
	['HTMLStyleElement', 'style'],
	['HTMLTableElement', 'table'],
	['HTMLTableCaptionElement', 'caption'],
	['HTMLTableCellElement', 'td', 'HTMLTableDataCellElement'],
	['HTMLTableCellElement', 'th', 'HTMLTableHeaderCellElement'],
	['HTMLTableRowElement', 'tr'],
	['HTMLTableColElement', 'col'],
	['HTMLTableColElement', 'colgroup'],
	['HTMLTableSectionElement', 'tbody'],
	['HTMLTableSectionElement', 'thead'],
	['HTMLTableSectionElement', 'tfoot'],
	['HTMLTemplateElement', 'template'],
	['HTMLTextAreaElement', 'textarea'],
	['HTMLTimeElement', 'time'],
	['HTMLTitleElement', 'title'],
	['HTMLTrackElement', 'track'],
	['HTMLUListElement', 'ul'],
	['HTMLVideoElement', 'video']
];

// eslint-disable-next-line consistent-return, max-params
var getConstructor = function getTagConstructor(tag, constructor, unknown) {
	if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
		var actual = document.createElement(tag).constructor;
		if (actual !== unknown) {
			return actual;
		}
	}
};

module.exports = function getData() {
	var unknown = global.HTMLUnknownElement;
	return {
		all: global.HTMLElement,
		elements: map(expecteds, function (expected) {
			var constructorName = expected[0];
			var tag = expected[1];
			var alternate = expected[2];
			var constructor = global[constructorName];
			var altConstructor = alternate && global[alternate];

			return {
				constructor: getConstructor(tag, altConstructor || constructor, unknown),
				constructorName: altConstructor ? alternate : constructorName,
				expectedConstructor: altConstructor || constructor,
				tag: tag
			};
		}),
		unknown: unknown
	};
};
