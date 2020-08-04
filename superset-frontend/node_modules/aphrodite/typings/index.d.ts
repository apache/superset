import {
    CSSProperties,
    CSSPropertiesComplete,
    CSSPropertiesLossy,
    CSSPropertiesPseudo,
    CSSWideKeyword,
} from './css-properties';

export {
    CSSProperties,
    CSSPropertiesComplete,
    CSSPropertiesLossy,
    CSSPropertiesPseudo,
    CSSWideKeyword,
};

/**
 * Aphrodite style declaration
 */
export type StyleDeclarationMap = Map<keyof CSSProperties, string | number>;
export type StyleDeclaration<T = {}> = {
    [P in keyof T]: CSSProperties | StyleDeclarationMap;
};

/**
 * Return value from StyleSheet.create.
 */
export type StyleDeclarationValue = object;

export interface StyleSheetStatic {
    /**
     * Create style sheet
     */
    create<T extends StyleDeclaration<T>>(
        styles: T
    ): {[K in keyof T]: StyleDeclarationValue };
    /**
     * Rehydrate class names from server renderer
     */
    rehydrate(renderedClassNames: string[]): void;
    
    extend(extensions: Extension[]): Exports;
}

export var StyleSheet: StyleSheetStatic;

type CSSInputTypes = StyleDeclarationValue | false | null | void;
/**
 * Get class names from passed styles
 */
export function css(...styles: CSSInputTypes[]): string;

/**
 *  Override Aphrodite minifying styles to hashes in production
 */
export function minify(shouldMinify: boolean): void;

interface StaticRendererResult {
    html: string;
    css: {
        content: string;
        renderedClassNames: string[];
    };
}

/**
 * Utilities for using Aphrodite server-side.
 */
interface StyleSheetServerStatic {
    renderStatic(renderFunc: () => string): StaticRendererResult;
}

export var StyleSheetServer: StyleSheetServerStatic;

interface StyleSheetTestUtilsStatic {
    /**
     * Prevent styles from being injected into the DOM.
     *
     * This is useful in situations where you'd like to test rendering UI
     * components which use Aphrodite without any of the side-effects of
     * Aphrodite happening. Particularly useful for testing the output of
     * components when you have no DOM, e.g. testing in Node without a fake DOM.
     *
     * Should be paired with a subsequent call to
     * clearBufferAndResumeStyleInjection.
     */
    suppressStyleInjection(): void;
    /**
     * Opposite method of preventStyleInject.
     */
    clearBufferAndResumeStyleInjection(): void;
    /**
     * Returns a string of buffered styles which have not been flushed
     *
     * @returns {string}  Buffer of styles which have not yet been flushed.
     */
    getBufferedStyles(): string[];
}

export var StyleSheetTestUtils: StyleSheetTestUtilsStatic;

export interface SelectorHandler {
    (selector: string, baseSelector: string, callback: (selector: string) => string):
        | string
        | null;
}

export interface Extension {
    selectorHandler?: SelectorHandler;
}

/**
 * Calling StyleSheet.extend() returns an object with each of the exported
 * properties on it.
 */
interface Exports {
    css(...styles: CSSInputTypes[]): string;
    StyleSheet: StyleSheetStatic;
    StyleSheetServer: StyleSheetServerStatic;
    StyleSheetTestUtils: StyleSheetTestUtilsStatic;
}