'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _ariaQuery = require('aria-query');

var _axobjectQuery = require('axobject-query');

var _arrayIncludes = require('array-includes');

var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);

var _attributesComparator = require('./attributesComparator');

var _attributesComparator2 = _interopRequireDefault(_attributesComparator);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var roleKeys = [].concat(_toConsumableArray(_ariaQuery.roles.keys()));
var elementRoleEntries = [].concat(_toConsumableArray(_ariaQuery.elementRoles));

var nonInteractiveRoles = new Set(roleKeys.filter(function (name) {
  var role = _ariaQuery.roles.get(name);
  return !role.abstract && !role.superClass.some(function (classes) {
    return (0, _arrayIncludes2.default)(classes, 'widget');
  });
}));

var interactiveRoles = new Set([].concat(roleKeys,
// 'toolbar' does not descend from widget, but it does support
// aria-activedescendant, thus in practice we treat it as a widget.
'toolbar').filter(function (name) {
  var role = _ariaQuery.roles.get(name);
  return !role.abstract && role.superClass.some(function (classes) {
    return (0, _arrayIncludes2.default)(classes, 'widget');
  });
}));

var nonInteractiveElementRoleSchemas = elementRoleEntries.reduce(function (accumulator, _ref) {
  var _ref2 = _slicedToArray(_ref, 2),
      elementSchema = _ref2[0],
      roleSet = _ref2[1];

  if ([].concat(_toConsumableArray(roleSet)).every(function (role) {
    return nonInteractiveRoles.has(role);
  })) {
    accumulator.push(elementSchema);
  }
  return accumulator;
}, []);

var interactiveElementRoleSchemas = elementRoleEntries.reduce(function (accumulator, _ref3) {
  var _ref4 = _slicedToArray(_ref3, 2),
      elementSchema = _ref4[0],
      roleSet = _ref4[1];

  if ([].concat(_toConsumableArray(roleSet)).some(function (role) {
    return interactiveRoles.has(role);
  })) {
    accumulator.push(elementSchema);
  }
  return accumulator;
}, []);

var interactiveAXObjects = new Set([].concat(_toConsumableArray(_axobjectQuery.AXObjects.keys())).filter(function (name) {
  return _axobjectQuery.AXObjects.get(name).type === 'widget';
}));

var interactiveElementAXObjectSchemas = [].concat(_toConsumableArray(_axobjectQuery.elementAXObjects)).reduce(function (accumulator, _ref5) {
  var _ref6 = _slicedToArray(_ref5, 2),
      elementSchema = _ref6[0],
      AXObjectSet = _ref6[1];

  if ([].concat(_toConsumableArray(AXObjectSet)).every(function (role) {
    return interactiveAXObjects.has(role);
  })) {
    accumulator.push(elementSchema);
  }
  return accumulator;
}, []);

function checkIsInteractiveElement(tagName, attributes) {
  function elementSchemaMatcher(elementSchema) {
    return tagName === elementSchema.name && (0, _attributesComparator2.default)(elementSchema.attributes, attributes);
  }
  // Check in elementRoles for inherent interactive role associations for
  // this element.
  var isInherentInteractiveElement = interactiveElementRoleSchemas.some(elementSchemaMatcher);
  if (isInherentInteractiveElement) {
    return true;
  }
  // Check in elementRoles for inherent non-interactive role associations for
  // this element.
  var isInherentNonInteractiveElement = nonInteractiveElementRoleSchemas.some(elementSchemaMatcher);
  if (isInherentNonInteractiveElement) {
    return false;
  }
  // Check in elementAXObjects for AX Tree associations for this element.
  var isInteractiveAXElement = interactiveElementAXObjectSchemas.some(elementSchemaMatcher);
  if (isInteractiveAXElement) {
    return true;
  }

  return false;
}

/**
 * Returns boolean indicating whether the given element is
 * interactive on the DOM or not. Usually used when an element
 * has a dynamic handler on it and we need to discern whether or not
 * it's intention is to be interacted with on the DOM.
 */
var isInteractiveElement = function isInteractiveElement(tagName, attributes) {
  // Do not test higher level JSX components, as we do not know what
  // low-level DOM element this maps to.
  if (!_ariaQuery.dom.keys(tagName)) {
    return false;
  }

  return checkIsInteractiveElement(tagName, attributes);
};

exports.default = isInteractiveElement;