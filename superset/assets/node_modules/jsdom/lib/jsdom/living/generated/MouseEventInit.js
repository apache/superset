"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const EventModifierInit = require("./EventModifierInit");

module.exports = {
  convertInherit(obj, ret) {
    EventModifierInit.convertInherit(obj, ret);
    let key, value;

    key = "button";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["short"](value);
    } else {
      ret[key] = 0;
    }

    key = "buttons";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["unsigned short"](value);
    } else {
      ret[key] = 0;
    }

    key = "clientX";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["long"](value);
    } else {
      ret[key] = 0;
    }

    key = "clientY";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["long"](value);
    } else {
      ret[key] = 0;
    }

    key = "relatedTarget";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = (value);
    } else {
      ret[key] = null;
    }

    key = "screenX";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["long"](value);
    } else {
      ret[key] = 0;
    }

    key = "screenY";
    value = obj === undefined || obj === null ? undefined : obj[key];
    if (value !== undefined) {
      ret[key] = conversions["long"](value);
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