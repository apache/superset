/* @flow */
import asap from 'asap';

import OrderedElements from './ordered-elements';
import {generateCSS} from './generate';
import {hashObject, hashString} from './util';

/* ::
import type { SheetDefinition, SheetDefinitions } from './index.js';
import type { MaybeSheetDefinition } from './exports.js';
import type { SelectorHandler } from './generate.js';
type ProcessedStyleDefinitions = {
  classNameBits: Array<string>,
  definitionBits: Array<Object>,
};
*/

// The current <style> tag we are inserting into, or null if we haven't
// inserted anything yet. We could find this each time using
// `document.querySelector("style[data-aphrodite"])`, but holding onto it is
// faster.
let styleTag = null;

// Inject a string of styles into a <style> tag in the head of the document. This
// will automatically create a style tag and then continue to use it for
// multiple injections. It will also use a style tag with the `data-aphrodite`
// tag on it if that exists in the DOM. This could be used for e.g. reusing the
// same style tag that server-side rendering inserts.
const injectStyleTag = (cssContents /* : string */) => {
    if (styleTag == null) {
        // Try to find a style tag with the `data-aphrodite` attribute first.
        styleTag = document.querySelector("style[data-aphrodite]");

        // If that doesn't work, generate a new style tag.
        if (styleTag == null) {
            // Taken from
            // http://stackoverflow.com/questions/524696/how-to-create-a-style-tag-with-javascript
            const head = document.head || document.getElementsByTagName('head')[0];
            styleTag = document.createElement('style');

            styleTag.type = 'text/css';
            styleTag.setAttribute("data-aphrodite", "");
            head.appendChild(styleTag);
        }
    }


    if (styleTag.styleSheet) {
        // $FlowFixMe: legacy Internet Explorer compatibility
        styleTag.styleSheet.cssText += cssContents;
    } else {
        styleTag.appendChild(document.createTextNode(cssContents));
    }
};

// Custom handlers for stringifying CSS values that have side effects
// (such as fontFamily, which can cause @font-face rules to be injected)
const stringHandlers = {
    // With fontFamily we look for objects that are passed in and interpret
    // them as @font-face rules that we need to inject. The value of fontFamily
    // can either be a string (as normal), an object (a single font face), or
    // an array of objects and strings.
    fontFamily: function fontFamily(val) {
        if (Array.isArray(val)) {
            return val.map(fontFamily).join(",");
        } else if (typeof val === "object") {
            injectStyleOnce(val.src, "@font-face", [val], false);
            return `"${val.fontFamily}"`;
        } else {
            return val;
        }
    },

    // With animationName we look for an object that contains keyframes and
    // inject them as an `@keyframes` block, returning a uniquely generated
    // name. The keyframes object should look like
    //  animationName: {
    //    from: {
    //      left: 0,
    //      top: 0,
    //    },
    //    '50%': {
    //      left: 15,
    //      top: 5,
    //    },
    //    to: {
    //      left: 20,
    //      top: 20,
    //    }
    //  }
    // TODO(emily): `stringHandlers` doesn't let us rename the key, so I have
    // to use `animationName` here. Improve that so we can call this
    // `animation` instead of `animationName`.
    animationName: function animationName(val, selectorHandlers) {
        if (Array.isArray(val)) {
            return val.map(v => animationName(v, selectorHandlers)).join(",");
        } else if (typeof val === "object") {
            // Generate a unique name based on the hash of the object. We can't
            // just use the hash because the name can't start with a number.
            // TODO(emily): this probably makes debugging hard, allow a custom
            // name?
            const name = `keyframe_${hashObject(val)}`;

            // Since keyframes need 3 layers of nesting, we use `generateCSS` to
            // build the inner layers and wrap it in `@keyframes` ourselves.
            let finalVal = `@keyframes ${name}{`;

            // TODO see if we can find a way where checking for OrderedElements
            // here is not necessary. Alternatively, perhaps we should have a
            // utility method that can iterate over either a plain object, an
            // instance of OrderedElements, or a Map, and then use that here and
            // elsewhere.
            if (val instanceof OrderedElements) {
                val.forEach((valVal, valKey) => {
                    finalVal += generateCSS(
                        valKey, [valVal], selectorHandlers, stringHandlers, false);
                });
            } else {
                Object.keys(val).forEach(key => {
                    finalVal += generateCSS(
                        key, [val[key]], selectorHandlers, stringHandlers, false);
                });
            }
            finalVal += '}';

            injectGeneratedCSSOnce(name, finalVal);

            return name;
        } else {
            return val;
        }
    },
};

// This is a map from Aphrodite's generated class names to `true` (acting as a
// set of class names)
let alreadyInjected = {};

// This is the buffer of styles which have not yet been flushed.
let injectionBuffer = "";

// A flag to tell if we are already buffering styles. This could happen either
// because we scheduled a flush call already, so newly added styles will
// already be flushed, or because we are statically buffering on the server.
let isBuffering = false;

const injectGeneratedCSSOnce = (key, generatedCSS) => {
    if (alreadyInjected[key]) {
        return;
    }

    if (!isBuffering) {
        // We should never be automatically buffering on the server (or any
        // place without a document), so guard against that.
        if (typeof document === "undefined") {
            throw new Error(
                "Cannot automatically buffer without a document");
        }

        // If we're not already buffering, schedule a call to flush the
        // current styles.
        isBuffering = true;
        asap(flushToStyleTag);
    }

    injectionBuffer += generatedCSS;
    alreadyInjected[key] = true;
}

export const injectStyleOnce = (
    key /* : string */,
    selector /* : string */,
    definitions /* : SheetDefinition[] */,
    useImportant /* : boolean */,
    selectorHandlers /* : SelectorHandler[] */ = []
) => {
    if (alreadyInjected[key]) {
        return;
    }

    const generated = generateCSS(
        selector, definitions, selectorHandlers,
        stringHandlers, useImportant);

    injectGeneratedCSSOnce(key, generated);
};

export const reset = () => {
    injectionBuffer = "";
    alreadyInjected = {};
    isBuffering = false;
    styleTag = null;
};

export const startBuffering = () => {
    if (isBuffering) {
        throw new Error(
            "Cannot buffer while already buffering");
    }
    isBuffering = true;
};

export const flushToString = () => {
    isBuffering = false;
    const ret = injectionBuffer;
    injectionBuffer = "";
    return ret;
};

export const flushToStyleTag = () => {
    const cssContent = flushToString();
    if (cssContent.length > 0) {
        injectStyleTag(cssContent);
    }
};

export const getRenderedClassNames = () => {
    return Object.keys(alreadyInjected);
};

export const addRenderedClassNames = (classNames /* : string[] */) => {
    classNames.forEach(className => {
        alreadyInjected[className] = true;
    });
};

const processStyleDefinitions = (
  styleDefinitions /* : any[] */,
  result /* : ProcessedStyleDefinitions */
) /* : void */ => {
    for (let i = 0; i < styleDefinitions.length; i += 1) {
        // Filter out falsy values from the input, to allow for
        // `css(a, test && c)`
        if (styleDefinitions[i]) {
            if (Array.isArray(styleDefinitions[i])) {
                // We've encountered an array, so let's recurse
                processStyleDefinitions(styleDefinitions[i], result);
            } else {
                result.classNameBits.push(styleDefinitions[i]._name);
                result.definitionBits.push(styleDefinitions[i]._definition);
            }
        }
    }
};

// Sum up the lengths of the stringified style definitions (which was saved as _len property)
// and use modulus to return a single byte hash value.
// We append this extra byte to the 32bit hash to decrease the chance of hash collisions.
const getStyleDefinitionsLengthHash = (styleDefinitions /* : any[] */) /* : string */ => (
    styleDefinitions.reduce(
        (length, styleDefinition) => length + (styleDefinition ? styleDefinition._len : 0)
    , 0) % 36
).toString(36);

/**
 * Inject styles associated with the passed style definition objects, and return
 * an associated CSS class name.
 *
 * @param {boolean} useImportant If true, will append !important to generated
 *     CSS output. e.g. {color: red} -> "color: red !important".
 * @param {(Object|Object[])[]} styleDefinitions style definition objects, or
 *     arbitrarily nested arrays of them, as returned as properties of the
 *     return value of StyleSheet.create().
 */
export const injectAndGetClassName = (
    useImportant /* : boolean */,
    styleDefinitions /* : MaybeSheetDefinition[] */,
    selectorHandlers /* : SelectorHandler[] */
) /* : string */ => {
    const processedStyleDefinitions /* : ProcessedStyleDefinitions */ = {
        classNameBits: [],
        definitionBits: [],
    };
    // Mutates processedStyleDefinitions
    processStyleDefinitions(styleDefinitions, processedStyleDefinitions);

    // Break if there aren't any valid styles.
    if (processedStyleDefinitions.classNameBits.length === 0) {
        return "";
    }

    let className;
    if (process.env.NODE_ENV === 'production') {
        className = processedStyleDefinitions.classNameBits.length === 1 ?
            `_${processedStyleDefinitions.classNameBits[0]}` :
            `_${hashString(processedStyleDefinitions.classNameBits.join())}${
                getStyleDefinitionsLengthHash(styleDefinitions)}`;
    } else {
        className = processedStyleDefinitions.classNameBits.join("-o_O-");
    }

    injectStyleOnce(
        className,
        `.${className}`,
        processedStyleDefinitions.definitionBits,
        useImportant,
        selectorHandlers
    );

    return className;
}
