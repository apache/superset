"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertShadowRootMode = require("./ShadowRootMode.js").convert;

module.exports = {
  convertInherit(obj, ret, { context = "The provided value" } = {}) {
    {
      const key = "mode";
      let value = obj === undefined || obj === null ? undefined : obj[key];
      if (value !== undefined) {
        value = convertShadowRootMode(value, { context: context + " has member mode that" });

        ret[key] = value;
      } else {
        throw new TypeError("mode is required in 'ShadowRootInit'");
      }
    }
  },

  convert(obj, { context = "The provided value" } = {}) {
    if (obj !== undefined && typeof obj !== "object" && typeof obj !== "function") {
      throw new TypeError(`${context} is not an object.`);
    }

    const ret = Object.create(null);
    module.exports.convertInherit(obj, ret, { context });
    return ret;
  }
};
