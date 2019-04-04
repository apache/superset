import { flushToStyleTag } from 'aphrodite/lib/inject';
import { from as flatten } from 'array-flatten';
import has from 'has';

// This function takes the array of styles and separates them into styles that
// are handled by Aphrodite and inline styles.
function separateStyles(stylesArray) {
  const aphroditeStyles = [];

  // Since determining if an Object is empty requires collecting all of its
  // keys, and we want the best performance in this code because we are in the
  // render path, we are going to do a little bookkeeping ourselves.
  let hasInlineStyles = false;
  const inlineStyles = {};

  // This is run on potentially every node in the tree when rendering, where
  // performance is critical. Normally we would prefer using `forEach`, but
  // old-fashioned for loops are faster so that's what we have chosen here.
  for (let i = 0; i < stylesArray.length; i++) { // eslint-disable-line no-plusplus
    const style = stylesArray[i];

    // If this  style is falsey, we just want to disregard it. This allows for
    // syntax like:
    //
    //   css(isFoo && styles.foo)
    if (style) {
      if (
        has(style, '_name') &&
        has(style, '_definition')
      ) {
        // This looks like a reference to an Aphrodite style object, so that's
        // where it goes.
        aphroditeStyles.push(style);
      } else {
        Object.assign(inlineStyles, style);
        hasInlineStyles = true;
      }
    }
  }

  return {
    aphroditeStyles,
    hasInlineStyles,
    inlineStyles,
  };
}

export default ({ StyleSheet, css }/* aphrodite */) => ({
  create(styleHash) {
    return StyleSheet.create(styleHash);
  },

  // Styles is an array of properties returned by `create()`, a POJO, or an
  // array thereof. POJOs are treated as inline styles.
  // This function returns an object to be spread onto an element.
  resolve(styles) {
    const flattenedStyles = flatten(styles);

    const {
      aphroditeStyles,
      hasInlineStyles,
      inlineStyles,
    } = separateStyles(flattenedStyles);

    const result = {};
    if (aphroditeStyles.length > 0) {
      result.className = css(...aphroditeStyles);
    }
    if (hasInlineStyles) {
      result.style = inlineStyles;
    }
    return result;
  },

  // Flushes all buffered styles to a style tag. Required for components
  // that depend upon previous styles in the component tree (i.e.
  // for calculating container width, including padding/margin).
  flush() {
    flushToStyleTag();
  },
});
