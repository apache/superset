"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const EventModifierInit = require("./EventModifierInit");

module.exports = {
  convertInherit(obj, ret) {
    EventModifierInit.convertInherit(obj, ret);
    let key, value;

    key = "charCode";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["unsigned long"](value);
    } else {
      ret[key] = 0;
    }

    key = "code";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["DOMString"](value);
    } else {
      ret[key] = "";
    }

    key = "isComposing";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "key";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["DOMString"](value);
    } else {
      ret[key] = "";
    }

    key = "keyCode";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["unsigned long"](value);
    } else {
      ret[key] = 0;
    }

    key = "location";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["unsigned long"](value);
    } else {
      ret[key] = 0;
    }

    key = "repeat";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "which";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["unsigned long"](value);
    } else {
      ret[key] = 0;
    }
  },

  convert(obj) {
    if (obj !== undefined && typeof obj !== "object") {
      throw new TypeError("Dictionary has to be an object");
    }
    if (obj instanceof Date || obj instanceof RegExp) {
      throw new TypeError("Dictionary may not be a Date or RegExp object");
    }

    const ret = Object.create(null);
    module.exports.convertInherit(obj, ret);
    return ret;
  }
};