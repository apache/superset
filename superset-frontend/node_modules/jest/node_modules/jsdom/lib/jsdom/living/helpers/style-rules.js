"use strict";
const cssom = require("cssom");
const defaultStyleSheet = require("../../browser/default-stylesheet");
const { matchesDontThrow } = require("./selectors");

const { forEach, indexOf } = Array.prototype;

let parsedDefaultStyleSheet;

// Properties for which getResolvedValue is implemented. This is less than
// every supported property.
// https://drafts.csswg.org/indexes/#properties
exports.propertiesWithResolvedValueImplemented = {
  __proto__: null,

  // https://drafts.csswg.org/css2/visufx.html#visibility
  visibility: {
    inherited: true,
    initial: "visible",
    computedValue: "as-specified"
  }
};

exports.forEachMatchingSheetRuleOfElement = (element, handleRule) => {
  function handleSheet(sheet) {
    forEach.call(sheet.cssRules, rule => {
      if (rule.media) {
        if (indexOf.call(rule.media, "screen") !== -1) {
          forEach.call(rule.cssRules, innerRule => {
            if (matches(innerRule, element)) {
              handleRule(innerRule);
            }
          });
        }
      } else if (matches(rule, element)) {
        handleRule(rule);
      }
    });
  }

  if (!parsedDefaultStyleSheet) {
    parsedDefaultStyleSheet = cssom.parse(defaultStyleSheet);
  }

  handleSheet(parsedDefaultStyleSheet);
  forEach.call(element.ownerDocument.styleSheets, handleSheet);
};

function matches(rule, element) {
  if (!rule.selectorText) {
    return false;
  }

  const cssSelectorSplitRe = /((?:[^,"']|"[^"]*"|'[^']*')+)/;
  const selectors = rule.selectorText.split(cssSelectorSplitRe);

  for (const selectorText of selectors) {
    if (
      selectorText !== "" &&
      selectorText !== "," &&
      matchesDontThrow(element, selectorText)
    ) {
      return true;
    }
  }

  return false;
}

// Naive implementation of https://drafts.csswg.org/css-cascade-4/#cascading
// based on the previous jsdom implementation of getComputedStyle.
// Does not implement https://drafts.csswg.org/css-cascade-4/#cascade-specificity,
// or rather specificity is only implemented by the order in which the matching
// rules appear. The last rule is the most specific while the first rule is
// the least specific.
function getCascadedPropertyValue(element, property) {
  let value = "";

  exports.forEachMatchingSheetRuleOfElement(element, rule => {
    value = rule.style.getPropertyValue(property);
  });

  return value;
}

// https://drafts.csswg.org/css-cascade-4/#specified-value
function getSpecifiedValue(element, property) {
  const cascade = getCascadedPropertyValue(element, property);

  if (cascade !== "") {
    return cascade;
  }

  // Defaulting
  const { initial, inherited } = exports.propertiesWithResolvedValueImplemented[property];
  if (inherited && element.parentElement !== null) {
    return getComputedValue(element.parentElement, property);
  }

  // root element without parent element or inherited property
  return initial;
}

// https://drafts.csswg.org/css-cascade-4/#computed-value
function getComputedValue(element, property) {
  const { computedValue } = exports.propertiesWithResolvedValueImplemented[property];
  if (computedValue === "as-specified") {
    return getSpecifiedValue(element, property);
  }

  throw new TypeError(`Internal error: unrecognized computed value instruction '${computedValue}'`);
}

// https://drafts.csswg.org/cssom/#resolved-value
// Only implements `visibility`
exports.getResolvedValue = (element, property) => {
  // Determined for special case properties, none of which are implemented here.
  // So we skip to "any other property: The resolved value is the computed value."
  return getComputedValue(element, property);
};
