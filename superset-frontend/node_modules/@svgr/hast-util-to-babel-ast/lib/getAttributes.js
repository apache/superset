"use strict";

exports.__esModule = true;
exports.default = void 0;

var t = _interopRequireWildcard(require("@babel/types"));

var _util = require("./util");

var _stringToObjectStyle = _interopRequireDefault(require("./stringToObjectStyle"));

var _mappings = require("./mappings");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function convertAriaAttribute(kebabKey) {
  const [aria, ...parts] = kebabKey.split('-');
  return `${aria}-${parts.join('').toLowerCase()}`;
}

function getKey(key, value, node) {
  const lowerCaseKey = key.toLowerCase();
  const mappedElementAttribute = _mappings.ELEMENT_ATTRIBUTE_MAPPING[node.name] && _mappings.ELEMENT_ATTRIBUTE_MAPPING[node.name][lowerCaseKey];
  const mappedAttribute = _mappings.ATTRIBUTE_MAPPING[lowerCaseKey];

  if (mappedElementAttribute || mappedAttribute) {
    return t.jsxIdentifier(mappedElementAttribute || mappedAttribute);
  }

  const kebabKey = (0, _util.kebabCase)(key);

  if (kebabKey.startsWith('aria-')) {
    return t.jsxIdentifier(convertAriaAttribute(kebabKey));
  }

  if (kebabKey.startsWith('data-')) {
    return t.jsxIdentifier(kebabKey);
  }

  return t.jsxIdentifier(key);
}

function getValue(key, value) {
  // Handle className
  if (Array.isArray(value)) {
    return t.stringLiteral((0, _util.replaceSpaces)(value.join(' ')));
  }

  if (key === 'style') {
    return t.jsxExpressionContainer((0, _stringToObjectStyle.default)(value));
  }

  if ((0, _util.isNumeric)(value)) {
    return t.jsxExpressionContainer(t.numericLiteral(Number(value)));
  }

  return t.stringLiteral((0, _util.replaceSpaces)(value));
}

const getAttributes = node => {
  const keys = Object.keys(node.properties);
  const attributes = [];
  let index = -1;

  while (++index < keys.length) {
    const key = keys[index];
    const value = node.properties[key];
    const attribute = t.jsxAttribute(getKey(key, value, node), getValue(key, value, node));
    attributes.push(attribute);
  }

  return attributes;
};

var _default = getAttributes;
exports.default = _default;