"use strict";

const {
  isValidFloatingPointNumber,
  isValidSimpleColor,
  parseFloatingPointNumber,
  stripLeadingAndTrailingASCIIWhitespace,
  stripNewlines,
  splitOnCommas
} = require("./strings");
const {
  isValidDateString,
  isValidMonthString,
  isValidTimeString,
  isValidWeekString,
  parseLocalDateAndTimeString,
  serializeNormalizedDateAndTime
} = require("./dates-and-times");
const whatwgURL = require("whatwg-url");

const NodeList = require("../generated/NodeList");
const { domSymbolTree } = require("./internal-constants");
const { closest, firstChildWithLocalName } = require("./traversal");
const NODE_TYPE = require("../node-type");
const { HTML_NS } = require("./namespaces");

exports.isDisabled = formControl => {
  if (formControl.localName === "button" || formControl.localName === "input" || formControl.localName === "select" ||
      formControl.localName === "textarea") {
    if (formControl.hasAttributeNS(null, "disabled")) {
      return true;
    }
  }

  let e = formControl.parentNode;
  while (e) {
    if (e.localName === "fieldset" && e.hasAttributeNS(null, "disabled")) {
      const firstLegendElementChild = firstChildWithLocalName(e, "legend");
      if (!firstLegendElementChild || !firstLegendElementChild.contains(formControl)) {
        return true;
      }
    }
    e = e.parentNode;
  }

  return false;
};

// https://html.spec.whatwg.org/multipage/forms.html#category-listed
const listedElements = new Set(["button", "fieldset", "input", "object", "output", "select", "textarea"]);
exports.isListed = formControl => listedElements.has(formControl._localName) && formControl.namespaceURI === HTML_NS;

// https://html.spec.whatwg.org/multipage/forms.html#category-submit
const submittableElements = new Set(["button", "input", "object", "select", "textarea"]);
exports.isSubmittable = formControl => {
  return submittableElements.has(formControl._localName) && formControl.namespaceURI === HTML_NS;
};

// https://html.spec.whatwg.org/multipage/forms.html#concept-submit-button
const submitButtonInputTypes = new Set(["submit", "image"]);
exports.isSubmitButton = formControl => {
  return ((formControl._localName === "input" && submitButtonInputTypes.has(formControl.type)) ||
          (formControl._localName === "button" && formControl.type === "submit")) &&
         formControl.namespaceURI === HTML_NS;
};

// https://html.spec.whatwg.org/multipage/forms.html#concept-button
const buttonInputTypes = new Set([...submitButtonInputTypes, "reset", "button"]);
exports.isButton = formControl => {
  return ((formControl._localName === "input" && buttonInputTypes.has(formControl.type)) ||
          formControl._localName === "button") &&
         formControl.namespaceURI === HTML_NS;
};

exports.normalizeToCRLF = string => {
  return string.replace(/\r([^\n])/g, "\r\n$1")
    .replace(/\r$/, "\r\n")
    .replace(/([^\r])\n/g, "$1\r\n")
    .replace(/^\n/, "\r\n");
};

exports.isLabelable = node => {
  // labelable logic defined at: https://html.spec.whatwg.org/multipage/forms.html#category-label
  if (node.nodeType !== NODE_TYPE.ELEMENT_NODE) {
    return false;
  }

  switch (node.tagName) {
    case "BUTTON":
    case "METER":
    case "OUTPUT":
    case "PROGRESS":
    case "SELECT":
    case "TEXTAREA":
      return true;

    case "INPUT":
      return node.type !== "hidden";
  }

  return false;
};

exports.getLabelsForLabelable = labelable => {
  if (!exports.isLabelable(labelable)) {
    return null;
  }
  if (!labelable._labels) {
    const root = labelable.getRootNode({});
    labelable._labels = NodeList.create([], {
      element: root,
      query: () => {
        const nodes = [];
        for (const descendant of domSymbolTree.treeIterator(root)) {
          if (descendant.control === labelable) {
            nodes.push(descendant);
          }
        }
        return nodes;
      }
    });
  }
  return labelable._labels;
};

// https://html.spec.whatwg.org/multipage/forms.html#valid-e-mail-address
exports.isValidEmailAddress = (emailAddress, multiple = false) => {
  const emailAddressRegExp = new RegExp("^[a-zA-Z0-9.!#$%&'*+\\/=?^_`{|}~-]+@[a-zA-Z0-9]" +
    "(?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}" +
    "[a-zA-Z0-9])?)*$");
  // A valid e-mail address list is a set of comma-separated tokens, where each token is itself
  // a valid e - mail address.To obtain the list of tokens from a valid e - mail address list,
  // an implementation must split the string on commas.
  if (multiple) {
    return splitOnCommas(emailAddress).every(value => emailAddressRegExp.test(value));
  }
  return emailAddressRegExp.test(emailAddress);
};

exports.isValidAbsoluteURL = url => {
  return whatwgURL.parseURL(url) !== null;
};

exports.sanitizeValueByType = (input, val) => {
  switch (input.type.toLowerCase()) {
    case "password":
    case "search":
    case "tel":
    case "text":
      val = stripNewlines(val);
      break;

    case "color":
      // https://html.spec.whatwg.org/multipage/forms.html#color-state-(type=color):value-sanitization-algorithm
      val = isValidSimpleColor(val) ? val.toLowerCase() : "#000000";
      break;

    case "date":
      // https://html.spec.whatwg.org/multipage/input.html#date-state-(type=date):value-sanitization-algorithm
      if (!isValidDateString(val)) {
        val = "";
      }
      break;

    case "datetime-local": {
      // https://html.spec.whatwg.org/multipage/input.html#local-date-and-time-state-(type=datetime-local):value-sanitization-algorithm
      const dateAndTime = parseLocalDateAndTimeString(val);
      val = dateAndTime !== null ? serializeNormalizedDateAndTime(dateAndTime) : "";
      break;
    }

    case "email":
      // https://html.spec.whatwg.org/multipage/forms.html#e-mail-state-(type=email):value-sanitization-algorithm
      // https://html.spec.whatwg.org/multipage/forms.html#e-mail-state-(type=email):value-sanitization-algorithm-2
      if (input.hasAttributeNS(null, "multiple")) {
        val = val.split(",").map(token => stripLeadingAndTrailingASCIIWhitespace(token)).join(",");
      } else {
        val = stripNewlines(val);
        val = stripLeadingAndTrailingASCIIWhitespace(val);
      }
      break;

    case "month":
      // https://html.spec.whatwg.org/multipage/input.html#month-state-(type=month):value-sanitization-algorithm
      if (!isValidMonthString(val)) {
        val = "";
      }
      break;

    case "number":
      // https://html.spec.whatwg.org/multipage/input.html#number-state-(type=number):value-sanitization-algorithm
      // TODO: using parseFloatingPointNumber in addition to isValidFloatingPointNumber to pass number.html WPT.
      // Possible spec bug.
      if (!isValidFloatingPointNumber(val) || isNaN(parseFloatingPointNumber(val))) {
        val = "";
      }
      break;

    case "range":
      // https://html.spec.whatwg.org/multipage/input.html#range-state-(type=range):value-sanitization-algorithm
      // TODO: using parseFloatingPointNumber in addition to isValidFloatingPointNumber to pass number.html WPT.
      // Possible spec bug.
      if (!isValidFloatingPointNumber(val) || isNaN(parseFloatingPointNumber(val))) {
        const minimum = input._minimum;
        const maximum = input._maximum;
        const defaultValue = maximum < minimum ? minimum : (minimum + maximum) / 2;
        val = `${defaultValue}`;
      }
      break;

    case "time":
      // https://html.spec.whatwg.org/multipage/input.html#time-state-(type=time):value-sanitization-algorithm
      if (!isValidTimeString(val)) {
        val = "";
      }
      break;

    case "url":
      // https://html.spec.whatwg.org/multipage/forms.html#url-state-(type=url):value-sanitization-algorithm
      val = stripNewlines(val);
      val = stripLeadingAndTrailingASCIIWhitespace(val);
      break;

    case "week":
      // https://html.spec.whatwg.org/multipage/input.html#week-state-(type=week):value-sanitization-algorithm
      if (!isValidWeekString(val)) {
        val = "";
      }
  }

  return val;
};

// https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#form-owner
// TODO: The spec describes an imperative process for assigning/resetting an element's form
// owner based on activities involving form-associated elements. This simpler implementation
// instead calculates the current form owner only when the property is accessed. This is not
// sufficient to pass all the web platform tests, but is good enough for most purposes. We
// should eventually update it to use the correct version, though. See
// https://github.com/whatwg/html/issues/4050 for some discussion.

exports.formOwner = formControl => {
  const formAttr = formControl.getAttributeNS(null, "form");
  if (formAttr === "") {
    return null;
  }
  if (formAttr === null) {
    return closest(formControl, "form");
  }

  const root = formControl.getRootNode({});
  let firstElementWithId;
  for (const descendant of domSymbolTree.treeIterator(root)) {
    if (descendant.nodeType === NODE_TYPE.ELEMENT_NODE &&
      descendant.getAttributeNS(null, "id") === formAttr) {
      firstElementWithId = descendant;
      break;
    }
  }

  if (firstElementWithId &&
    firstElementWithId.namespaceURI === HTML_NS &&
    firstElementWithId.localName === "form") {
    return firstElementWithId;
  }
  return null;
};
