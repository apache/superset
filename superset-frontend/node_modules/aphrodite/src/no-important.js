/* @flow */
// Module with the same interface as the core aphrodite module,
// except that styles injected do not automatically have !important
// appended to them.
import makeExports from './exports';

const useImportant = false; // Don't add !important to style definitions

const Aphrodite = makeExports(useImportant);

const {
    StyleSheet,
    StyleSheetServer,
    StyleSheetTestUtils,
    css,
    minify,
    flushToStyleTag,
    injectAndGetClassName,
    defaultSelectorHandlers,
} = Aphrodite;

export {
    StyleSheet,
    StyleSheetServer,
    StyleSheetTestUtils,
    css,
    minify,
    flushToStyleTag,
    injectAndGetClassName,
    defaultSelectorHandlers,
};
