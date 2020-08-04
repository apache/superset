"use strict";
const addConstants = require("../utils").addConstants;
const table = require("./dom-exception-table.json"); // https://heycam.github.io/webidl/#idl-DOMException-error-names

// Precompute some stuff. Mostly unnecessary once we take care of the TODO below.
const namesWithCodes = Object.keys(table).filter(name => "legacyCodeValue" in table[name]);

const codesToNames = Object.create(null);
for (const name of namesWithCodes) {
  codesToNames[table[name].legacyCodeValue] = name;
}

module.exports = DOMException;

// TODO: update constructor signature to match WebIDL spec
// See also https://github.com/heycam/webidl/pull/22 which isn't merged as of yet
function DOMException(code, message) {
  const name = codesToNames[code];

  if (message === undefined) {
    message = table[name].description;
  }
  Error.call(this, message);

  Object.defineProperty(this, "name", { value: name, writable: true, configurable: true, enumerable: false });
  Object.defineProperty(this, "code", { value: code, writable: true, configurable: true, enumerable: false });

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, DOMException);
  }
}

Object.setPrototypeOf(DOMException, Error);
Object.setPrototypeOf(DOMException.prototype, Error.prototype);

const constants = Object.create(null);
for (const name of namesWithCodes) {
  constants[table[name].legacyCodeName] = table[name].legacyCodeValue;
}

addConstants(DOMException, constants);
