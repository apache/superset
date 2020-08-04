"use strict";

const RESTRICTED_CUSTOM_ELEMENT_NAME = new Set([
  "annotation-xml",
  "color-profile",
  "font-face",
  "font-face-src",
  "font-face-uri",
  "font-face-format",
  "font-face-name",
  "missing-glyph"
]);

const CUSTOM_ELEMENT_NAME_REGEXP = /^[a-z][-.0-9_a-z]*-[-.0-9_a-z]*$/;

// https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
function isValidCustomElementName(name) {
  if (RESTRICTED_CUSTOM_ELEMENT_NAME.has(name)) {
    return false;
  }

  return CUSTOM_ELEMENT_NAME_REGEXP.test(name);
}

module.exports = {
  isValidCustomElementName
};
