"use strict";

exports.__esModule = true;
exports.element = exports.text = exports.comment = exports.root = void 0;

var t = _interopRequireWildcard(require("@babel/types"));

var _all = _interopRequireDefault(require("./all"));

var _getAttributes = _interopRequireDefault(require("./getAttributes"));

var _mappings = require("./mappings");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const root = (h, node) => t.program((0, _all.default)(h, node));

exports.root = root;

const comment = (h, node, parent) => {
  if (parent.type === 'root') {
    return null;
  }

  const expression = t.jsxEmptyExpression();
  t.addComment(expression, 'inner', node.value);
  return t.jsxExpressionContainer(expression);
};

exports.comment = comment;

const text = (h, node, parent) => {
  if (parent.type === 'root') {
    return null;
  }

  if (node.value.match(/^\s+$/)) {
    return null;
  }

  return t.jsxExpressionContainer(t.stringLiteral(node.value));
};

exports.text = text;

const element = (h, node, parent) => {
  const children = (0, _all.default)(h, node);
  const selfClosing = children.length === 0;
  const name = _mappings.ELEMENT_TAG_NAME_MAPPING[node.tagName] || node.tagName;
  const openingElement = t.jsxOpeningElement(t.jsxIdentifier(name), (0, _getAttributes.default)(node), selfClosing);
  const closingElement = !selfClosing ? t.jsxClosingElement(t.jsxIdentifier(name)) : null;
  const jsxElement = t.jsxElement(openingElement, closingElement, children);

  if (parent.type === 'root') {
    return t.expressionStatement(jsxElement);
  }

  return jsxElement;
};

exports.element = element;