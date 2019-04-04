/* @flow */
import {mapObj, hashString} from './util';
import {
    injectAndGetClassName,
    reset, startBuffering, flushToString,
    addRenderedClassNames, getRenderedClassNames,
} from './inject';

/* ::
import type { SelectorHandler } from './generate.js';
export type SheetDefinition = { [id:string]: any };
export type SheetDefinitions = SheetDefinition | SheetDefinition[];
type RenderFunction = () => string;
type Extension = {
    selectorHandler: SelectorHandler
};
export type MaybeSheetDefinition = SheetDefinition | false | null | void
*/

const StyleSheet = {
    create(sheetDefinition /* : SheetDefinition */) {
        return mapObj(sheetDefinition, ([key, val]) => {
            const stringVal = JSON.stringify(val);
            return [key, {
                _len: stringVal.length,
                _name: process.env.NODE_ENV === 'production' ?
                    hashString(stringVal) : `${key}_${hashString(stringVal)}`,
                _definition: val
            }];
        });
    },

    rehydrate(renderedClassNames /* : string[] */ =[]) {
        addRenderedClassNames(renderedClassNames);
    },
};

/**
 * Utilities for using Aphrodite server-side.
 */
const StyleSheetServer = {
    renderStatic(renderFunc /* : RenderFunction */) {
        reset();
        startBuffering();
        const html = renderFunc();
        const cssContent = flushToString();

        return {
            html: html,
            css: {
                content: cssContent,
                renderedClassNames: getRenderedClassNames(),
            },
        };
    },
};

/**
 * Utilities for using Aphrodite in tests.
 *
 * Not meant to be used in production.
 */
const StyleSheetTestUtils = {
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
    suppressStyleInjection() {
        reset();
        startBuffering();
    },

    /**
     * Opposite method of preventStyleInject.
     */
    clearBufferAndResumeStyleInjection() {
        reset();
    },
};

/**
 * Generate the Aphrodite API exports, with given `selectorHandlers` and
 * `useImportant` state.
 */
const makeExports = (
    useImportant /* : boolean */,
    selectorHandlers /* : SelectorHandler[] */
) => {
    return {
        StyleSheet: {
            ...StyleSheet,

            /**
             * Returns a version of the exports of Aphrodite (i.e. an object
             * with `css` and `StyleSheet` properties) which have some
             * extensions included.
             *
             * @param {Array.<Object>} extensions: An array of extensions to
             *     add to this instance of Aphrodite. Each object should have a
             *     single property on it, defining which kind of extension to
             *     add.
             * @param {SelectorHandler} [extensions[].selectorHandler]: A
             *     selector handler extension. See `defaultSelectorHandlers` in
             *     generate.js.
             *
             * @returns {Object} An object containing the exports of the new
             *     instance of Aphrodite.
             */
            extend(extensions /* : Extension[] */) {
                const extensionSelectorHandlers = extensions
                    // Pull out extensions with a selectorHandler property
                    .map(extension => extension.selectorHandler)
                    // Remove nulls (i.e. extensions without a selectorHandler
                    // property).
                    .filter(handler => handler);

                return makeExports(
                    useImportant,
                    selectorHandlers.concat(extensionSelectorHandlers)
                );
            },
        },

        StyleSheetServer,
        StyleSheetTestUtils,

        css(...styleDefinitions /* : MaybeSheetDefinition[] */) {
            return injectAndGetClassName(
                useImportant, styleDefinitions, selectorHandlers);
        },
    };
};

module.exports = makeExports;
