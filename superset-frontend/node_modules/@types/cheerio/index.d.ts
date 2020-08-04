// Type definitions for Cheerio v0.22.0
// Project: https://github.com/cheeriojs/cheerio
// Definitions by: Bret Little <https://github.com/blittle>
//                 VILIC VANE <http://vilic.info>
//                 Wayne Maurer <https://github.com/wmaurer>
//                 Umar Nizamani <https://github.com/umarniz>
//                 LiJinyao <https://github.com/LiJinyao>
//                 Chennakrishna <https://github.com/chennakrishna8>
//                 AzSiAz <https://github.com/AzSiAz>
//                 Ryo Ota <https://github.com/nwtgck>
//                 Trevor Reed <https://github.com/trevorhreed>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node" />

declare type AttrFunction = (el: CheerioElement, i: number, currentValue: string) => any;

interface Cheerio {
    // Document References
    // Cheerio https://github.com/cheeriojs/cheerio
    // JQuery http://api.jquery.com

    [index: number]: CheerioElement;
    cheerio: string;
    length: number;

    // Attributes

    attr(): { [attr: string]: string };
    attr(name: string): string | undefined;
    attr(name: string, value: AttrFunction): Cheerio;
    // `value` *can* be `any` here but:
    // 1. That makes type-checking the function-type useless
    // 2. It's converted to a string anyways
    attr(name: string, value: string): Cheerio;
    // The map's values *can* be `any` but they'll all be cast to strings
    // regardless.
    attr(map: { [key: string]: any }): Cheerio;

    data(): any;
    data(name: string): any;
    data(name: string, value: any): any;

    val(): string;
    val(value: string): Cheerio;

    removeAttr(name: string): Cheerio;

    has(selector: string): Cheerio;
    has(element: CheerioElement): Cheerio;

    hasClass(className: string): boolean;
    addClass(classNames: string): Cheerio;

    removeClass(): Cheerio;
    removeClass(className: string): Cheerio;
    removeClass(func: (index: number, className: string) => string): Cheerio;

    toggleClass(className: string): Cheerio;
    toggleClass(className: string, toggleSwitch: boolean): Cheerio;
    toggleClass(toggleSwitch?: boolean): Cheerio;
    toggleClass(
        func: (index: number, className: string, toggleSwitch: boolean) => string,
        toggleSwitch?: boolean,
    ): Cheerio;

    is(selector: string): boolean;
    is(element: CheerioElement): boolean;
    is(element: CheerioElement[]): boolean;
    is(selection: Cheerio): boolean;
    is(func: (index: number, element: CheerioElement) => boolean): boolean;

    // Form
    serialize(): string;
    serializeArray(): { name: string; value: string }[];

    // Traversing

    find(selector: string): Cheerio;
    find(element: Cheerio): Cheerio;

    parent(selector?: string): Cheerio;
    parents(selector?: string): Cheerio;
    parentsUntil(selector?: string, filter?: string): Cheerio;
    parentsUntil(element: CheerioElement, filter?: string): Cheerio;
    parentsUntil(element: Cheerio, filter?: string): Cheerio;

    prop(name: string): any;
    prop(name: string, value: any): Cheerio;

    closest(): Cheerio;
    closest(selector: string): Cheerio;

    next(selector?: string): Cheerio;
    nextAll(): Cheerio;
    nextAll(selector: string): Cheerio;

    nextUntil(selector?: string, filter?: string): Cheerio;
    nextUntil(element: CheerioElement, filter?: string): Cheerio;
    nextUntil(element: Cheerio, filter?: string): Cheerio;

    prev(selector?: string): Cheerio;
    prevAll(): Cheerio;
    prevAll(selector: string): Cheerio;

    prevUntil(selector?: string, filter?: string): Cheerio;
    prevUntil(element: CheerioElement, filter?: string): Cheerio;
    prevUntil(element: Cheerio, filter?: string): Cheerio;

    slice(start: number, end?: number): Cheerio;

    siblings(selector?: string): Cheerio;

    children(selector?: string): Cheerio;

    contents(): Cheerio;

    each(func: (index: number, element: CheerioElement) => any): Cheerio;
    map(func: (index: number, element: CheerioElement) => any): Cheerio;

    filter(selector: string): Cheerio;
    filter(selection: Cheerio): Cheerio;
    filter(element: CheerioElement): Cheerio;
    filter(elements: CheerioElement[]): Cheerio;
    filter(func: (index: number, element: CheerioElement) => boolean): Cheerio;

    not(selector: string): Cheerio;
    not(selection: Cheerio): Cheerio;
    not(element: CheerioElement): Cheerio;
    not(func: (index: number, element: CheerioElement) => boolean): Cheerio;

    first(): Cheerio;
    last(): Cheerio;

    eq(index: number): Cheerio;

    get(): any[];
    get(index: number): any;

    index(): number;
    index(selector: string): number;
    index(selection: Cheerio): number;

    end(): Cheerio;

    add(selectorOrHtml: string): Cheerio;
    add(selector: string, context: Document): Cheerio;
    add(element: CheerioElement): Cheerio;
    add(elements: CheerioElement[]): Cheerio;
    add(selection: Cheerio): Cheerio;

    addBack(): Cheerio;
    addBack(filter: string): Cheerio;

    // Manipulation
    appendTo(target: Cheerio): Cheerio;
    prependTo(target: Cheerio): Cheerio;

    append(content: string, ...contents: any[]): Cheerio;
    append(content: Document, ...contents: any[]): Cheerio;
    append(content: Document[], ...contents: any[]): Cheerio;
    append(content: Cheerio, ...contents: any[]): Cheerio;

    prepend(content: string, ...contents: any[]): Cheerio;
    prepend(content: Document, ...contents: any[]): Cheerio;
    prepend(content: Document[], ...contents: any[]): Cheerio;
    prepend(content: Cheerio, ...contents: any[]): Cheerio;

    after(content: string, ...contents: any[]): Cheerio;
    after(content: Document, ...contents: any[]): Cheerio;
    after(content: Document[], ...contents: any[]): Cheerio;
    after(content: Cheerio, ...contents: any[]): Cheerio;

    insertAfter(content: string): Cheerio;
    insertAfter(content: Document): Cheerio;
    insertAfter(content: Cheerio): Cheerio;

    before(content: string, ...contents: any[]): Cheerio;
    before(content: Document, ...contents: any[]): Cheerio;
    before(content: Document[], ...contents: any[]): Cheerio;
    before(content: Cheerio, ...contents: any[]): Cheerio;

    insertBefore(content: string): Cheerio;
    insertBefore(content: Document): Cheerio;
    insertBefore(content: Cheerio): Cheerio;

    remove(selector?: string): Cheerio;

    replaceWith(content: string): Cheerio;
    replaceWith(content: CheerioElement): Cheerio;
    replaceWith(content: CheerioElement[]): Cheerio;
    replaceWith(content: Cheerio): Cheerio;
    replaceWith(content: () => Cheerio): Cheerio;

    empty(): Cheerio;

    html(): string | null;
    html(html: string): Cheerio;

    text(): string;
    text(text: string): Cheerio;

    wrap(content: string): Cheerio;
    wrap(content: Document): Cheerio;
    wrap(content: Cheerio): Cheerio;

    css(propertyName: string): string;
    css(propertyNames: string[]): string[];
    css(propertyName: string, value: string): Cheerio;
    css(propertyName: string, value: number): Cheerio;
    css(propertyName: string, func: (index: number, value: string) => string): Cheerio;
    css(propertyName: string, func: (index: number, value: string) => number): Cheerio;
    css(properties: Object): Cheerio;

    // Rendering

    // Miscellaneous

    clone(): Cheerio;

    // Not Documented

    toArray(): CheerioElement[];
}

interface CheerioOptionsInterface {
    // Document References
    // Cheerio https://github.com/cheeriojs/cheerio
    // HTMLParser2 https://github.com/fb55/htmlparser2/wiki/Parser-options
    // DomHandler https://github.com/fb55/DomHandler

    xmlMode?: boolean;
    decodeEntities?: boolean;
    lowerCaseTags?: boolean;
    lowerCaseAttributeNames?: boolean;
    recognizeCDATA?: boolean;
    recognizeSelfClosing?: boolean;
    normalizeWhitespace?: boolean;
    withStartIndices?: boolean;
    withEndIndices?: boolean;
    ignoreWhitespace?: boolean;
    _useHtmlParser2?: boolean;
}

interface CheerioSelector {
    (selector: string): Cheerio;
    (selector: string, context: string): Cheerio;
    (selector: string, context: CheerioElement): Cheerio;
    (selector: string, context: CheerioElement[]): Cheerio;
    (selector: string, context: Cheerio): Cheerio;
    (selector: string, context: string, root: string): Cheerio;
    (selector: string, context: CheerioElement, root: string): Cheerio;
    (selector: string, context: CheerioElement[], root: string): Cheerio;
    (selector: string, context: Cheerio, root: string): Cheerio;
    (selector: any): Cheerio;
}

interface CheerioStatic extends CheerioSelector {
    // Document References
    // Cheerio https://github.com/cheeriojs/cheerio
    // JQuery http://api.jquery.com
    xml(): string;
    root(): Cheerio;
    contains(container: CheerioElement, contained: CheerioElement): boolean;
    parseHTML(data: string, context?: Document, keepScripts?: boolean): Document[];

    html(options?: CheerioOptionsInterface): string;
    html(selector: string, options?: CheerioOptionsInterface): string;
    html(element: Cheerio, options?: CheerioOptionsInterface): string;
    html(element: CheerioElement, options?: CheerioOptionsInterface): string;
}

interface CheerioElement {
    // Document References
    // Node Console
    tagName: string;
    type: string;
    name: string;
    attribs: { [attr: string]: string };
    children: CheerioElement[];
    childNodes: CheerioElement[];
    lastChild: CheerioElement;
    firstChild: CheerioElement;
    next: CheerioElement;
    nextSibling: CheerioElement;
    prev: CheerioElement;
    previousSibling: CheerioElement;
    parent: CheerioElement;
    parentNode: CheerioElement;
    nodeValue: string;
    data?: string;
    startIndex?: number;
}

interface CheerioAPI extends CheerioSelector, CheerioStatic {
    load(html: string | Buffer, options?: CheerioOptionsInterface): CheerioStatic;
    load(element: CheerioElement, options?: CheerioOptionsInterface): CheerioStatic;
}

interface Document {}

declare const cheerio: CheerioAPI;

declare module 'cheerio' {
    export = cheerio;
}
