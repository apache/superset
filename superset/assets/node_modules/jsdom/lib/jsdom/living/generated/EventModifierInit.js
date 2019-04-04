"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const UIEventInit = require("./UIEventInit");

module.exports = {
  convertInherit(obj, ret) {
    UIEventInit.convertInherit(obj, ret);
    let key, value;

    key = "altKey";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "ctrlKey";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "metaKey";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierAltGraph";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierCapsLock";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierFn";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierFnLock";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierHyper";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierNumLock";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierOS";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierScrollLock";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierSuper";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierSymbol";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "modifierSymbolLock";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
    }

    key = "shiftKey";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["boolean"](value);
    } else {
      ret[key] = false;
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