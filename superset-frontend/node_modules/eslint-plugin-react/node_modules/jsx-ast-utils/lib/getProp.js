'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = getProp;

var _propName = require('./propName');

var _propName2 = _interopRequireDefault(_propName);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DEFAULT_OPTIONS = {
  ignoreCase: true
};

/**
 * Returns the JSXAttribute itself or undefined, indicating the prop
 * is not present on the JSXOpeningElement.
 *
 */
function getProp() {
  var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var prop = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : DEFAULT_OPTIONS;

  function getName(name) {
    return options.ignoreCase ? name.toUpperCase() : name;
  }
  var propToFind = getName(prop);
  function isPropToFind(property) {
    return property.type === 'Property' && property.key.type === 'Identifier' && propToFind === getName(property.key.name);
  }

  var foundAttribute = props.find(function (attribute) {
    // If the props contain a spread prop, try to find the property in the object expression.
    if (attribute.type === 'JSXSpreadAttribute') {
      return attribute.argument.type === 'ObjectExpression' && propToFind !== getName('key') // https://github.com/reactjs/rfcs/pull/107
      && attribute.argument.properties.some(isPropToFind);
    }

    return propToFind === getName((0, _propName2.default)(attribute));
  });

  if (foundAttribute && foundAttribute.type === 'JSXSpreadAttribute') {
    return propertyToJSXAttribute(foundAttribute.argument.properties.find(isPropToFind));
  }

  return foundAttribute;
}

function propertyToJSXAttribute(node) {
  var key = node.key,
      value = node.value;

  return _extends({
    type: 'JSXAttribute',
    name: _extends({ type: 'JSXIdentifier', name: key.name }, getBaseProps(key)),
    value: value.type === 'Literal' ? value : _extends({ type: 'JSXExpressionContainer', expression: value }, getBaseProps(value))
  }, getBaseProps(node));
}

function getBaseProps(_ref) {
  var start = _ref.start,
      end = _ref.end,
      loc = _ref.loc,
      range = _ref.range;

  return _extends({
    loc: getBaseLocation(loc)
  }, start !== undefined ? { start: start } : {}, end !== undefined ? { end: end } : {}, range !== undefined ? { range: range } : {});
}

function getBaseLocation(_ref2) {
  var start = _ref2.start,
      end = _ref2.end,
      source = _ref2.source,
      filename = _ref2.filename;

  return _extends({
    start: start,
    end: end
  }, source !== undefined ? { source: source } : {}, filename !== undefined ? { filename: filename } : {});
}