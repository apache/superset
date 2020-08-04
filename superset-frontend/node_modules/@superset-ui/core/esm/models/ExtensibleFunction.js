"use strict";

exports.__esModule = true;
exports.default = void 0;

/**
 * From https://stackoverflow.com/questions/36871299/how-to-extend-function-with-es6-classes
 */
class ExtensibleFunction extends Function {
  constructor(fn) {
    super(); // eslint-disable-next-line @typescript-eslint/no-unsafe-return, no-constructor-return

    return Object.setPrototypeOf(fn, new.target.prototype);
  }

}

exports.default = ExtensibleFunction;