"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.guessType = exports.ADDITIONAL_PROPERTY_FLAG = undefined;

var _setImmediate2 = require("babel-runtime/core-js/set-immediate");

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

var _set = require("babel-runtime/core-js/set");

var _set2 = _interopRequireDefault(_set);

var _from = require("babel-runtime/core-js/array/from");

var _from2 = _interopRequireDefault(_from);

var _getIterator2 = require("babel-runtime/core-js/get-iterator");

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _toConsumableArray2 = require("babel-runtime/helpers/toConsumableArray");

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _isNan = require("babel-runtime/core-js/number/is-nan");

var _isNan2 = _interopRequireDefault(_isNan);

var _assign = require("babel-runtime/core-js/object/assign");

var _assign2 = _interopRequireDefault(_assign);

var _defineProperty2 = require("babel-runtime/helpers/defineProperty");

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

var _extends3 = require("babel-runtime/helpers/extends");

var _extends4 = _interopRequireDefault(_extends3);

var _objectWithoutProperties2 = require("babel-runtime/helpers/objectWithoutProperties");

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

exports.getDefaultRegistry = getDefaultRegistry;
exports.getSchemaType = getSchemaType;
exports.getWidget = getWidget;
exports.getDefaultFormState = getDefaultFormState;
exports.getUiOptions = getUiOptions;
exports.isObject = isObject;
exports.mergeObjects = mergeObjects;
exports.asNumber = asNumber;
exports.orderProperties = orderProperties;
exports.isConstant = isConstant;
exports.toConstant = toConstant;
exports.isSelect = isSelect;
exports.isMultiSelect = isMultiSelect;
exports.isFilesArray = isFilesArray;
exports.isFixedItems = isFixedItems;
exports.allowAdditionalItems = allowAdditionalItems;
exports.optionsList = optionsList;
exports.stubExistingAdditionalProperties = stubExistingAdditionalProperties;
exports.resolveSchema = resolveSchema;
exports.retrieveSchema = retrieveSchema;
exports.deepEquals = deepEquals;
exports.shouldRender = shouldRender;
exports.toIdSchema = toIdSchema;
exports.parseDateString = parseDateString;
exports.toDateString = toDateString;
exports.pad = pad;
exports.setState = setState;
exports.dataURItoBlob = dataURItoBlob;
exports.rangeSpec = rangeSpec;

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _validate = require("./validate");

var _validate2 = _interopRequireDefault(_validate);

var _fill = require("core-js/library/fn/array/fill");

var _fill2 = _interopRequireDefault(_fill);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ADDITIONAL_PROPERTY_FLAG = exports.ADDITIONAL_PROPERTY_FLAG = "__additional_property";

var widgetMap = {
  boolean: {
    checkbox: "CheckboxWidget",
    radio: "RadioWidget",
    select: "SelectWidget",
    hidden: "HiddenWidget"
  },
  string: {
    text: "TextWidget",
    password: "PasswordWidget",
    email: "EmailWidget",
    hostname: "TextWidget",
    ipv4: "TextWidget",
    ipv6: "TextWidget",
    uri: "URLWidget",
    "data-url": "FileWidget",
    radio: "RadioWidget",
    select: "SelectWidget",
    textarea: "TextareaWidget",
    hidden: "HiddenWidget",
    date: "DateWidget",
    datetime: "DateTimeWidget",
    "date-time": "DateTimeWidget",
    "alt-date": "AltDateWidget",
    "alt-datetime": "AltDateTimeWidget",
    color: "ColorWidget",
    file: "FileWidget"
  },
  number: {
    text: "TextWidget",
    select: "SelectWidget",
    updown: "UpDownWidget",
    range: "RangeWidget",
    radio: "RadioWidget",
    hidden: "HiddenWidget"
  },
  integer: {
    text: "TextWidget",
    select: "SelectWidget",
    updown: "UpDownWidget",
    range: "RangeWidget",
    radio: "RadioWidget",
    hidden: "HiddenWidget"
  },
  array: {
    select: "SelectWidget",
    checkboxes: "CheckboxesWidget",
    files: "FileWidget"
  }
};

function getDefaultRegistry() {
  return {
    fields: require("./components/fields").default,
    widgets: require("./components/widgets").default,
    definitions: {},
    formContext: {}
  };
}

function getSchemaType(schema) {
  var type = schema.type;

  if (!type && schema.enum) {
    type = "string";
  }
  return type;
}

function getWidget(schema, widget) {
  var registeredWidgets = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  var type = getSchemaType(schema);

  function mergeOptions(Widget) {
    // cache return value as property of widget for proper react reconciliation
    if (!Widget.MergedWidget) {
      var defaultOptions = Widget.defaultProps && Widget.defaultProps.options || {};
      Widget.MergedWidget = function (_ref) {
        var _ref$options = _ref.options,
            options = _ref$options === undefined ? {} : _ref$options,
            props = (0, _objectWithoutProperties3.default)(_ref, ["options"]);
        return _react2.default.createElement(Widget, (0, _extends4.default)({ options: (0, _extends4.default)({}, defaultOptions, options) }, props));
      };
    }
    return Widget.MergedWidget;
  }

  if (typeof widget === "function") {
    return mergeOptions(widget);
  }

  if (typeof widget !== "string") {
    throw new Error("Unsupported widget definition: " + (typeof widget === "undefined" ? "undefined" : (0, _typeof3.default)(widget)));
  }

  if (registeredWidgets.hasOwnProperty(widget)) {
    var registeredWidget = registeredWidgets[widget];
    return getWidget(schema, registeredWidget, registeredWidgets);
  }

  if (!widgetMap.hasOwnProperty(type)) {
    throw new Error("No widget for type \"" + type + "\"");
  }

  if (widgetMap[type].hasOwnProperty(widget)) {
    var _registeredWidget = registeredWidgets[widgetMap[type][widget]];
    return getWidget(schema, _registeredWidget, registeredWidgets);
  }

  throw new Error("No widget \"" + widget + "\" for type \"" + type + "\"");
}

function computeDefaults(schema, parentDefaults) {
  var definitions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  // Compute the defaults recursively: give highest priority to deepest nodes.
  var defaults = parentDefaults;
  if (isObject(defaults) && isObject(schema.default)) {
    // For object defaults, only override parent defaults that are defined in
    // schema.default.
    defaults = mergeObjects(defaults, schema.default);
  } else if ("default" in schema) {
    // Use schema defaults for this node.
    defaults = schema.default;
  } else if ("$ref" in schema) {
    // Use referenced schema defaults for this node.
    var refSchema = findSchemaDefinition(schema.$ref, definitions);
    return computeDefaults(refSchema, defaults, definitions);
  } else if (isFixedItems(schema)) {
    defaults = schema.items.map(function (itemSchema) {
      return computeDefaults(itemSchema, undefined, definitions);
    });
  }
  // Not defaults defined for this node, fallback to generic typed ones.
  if (typeof defaults === "undefined") {
    defaults = schema.default;
  }

  switch (schema.type) {
    // We need to recur for object schema inner default values.
    case "object":
      return (0, _keys2.default)(schema.properties || {}).reduce(function (acc, key) {
        // Compute the defaults for this node, with the parent defaults we might
        // have from a previous run: defaults[key].
        acc[key] = computeDefaults(schema.properties[key], (defaults || {})[key], definitions);
        return acc;
      }, {});

    case "array":
      if (schema.minItems) {
        if (!isMultiSelect(schema, definitions)) {
          var defaultsLength = defaults ? defaults.length : 0;
          if (schema.minItems > defaultsLength) {
            var defaultEntries = defaults || [];
            // populate the array with the defaults
            var fillerEntries = (0, _fill2.default)(new Array(schema.minItems - defaultsLength), computeDefaults(schema.items, schema.items.defaults, definitions));
            // then fill up the rest with either the item default or empty, up to minItems

            return defaultEntries.concat(fillerEntries);
          }
        } else {
          return [];
        }
      }
  }
  return defaults;
}

function getDefaultFormState(_schema, formData) {
  var definitions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  if (!isObject(_schema)) {
    throw new Error("Invalid schema: " + _schema);
  }
  var schema = retrieveSchema(_schema, definitions, formData);
  var defaults = computeDefaults(schema, _schema.default, definitions);
  if (typeof formData === "undefined") {
    // No form data? Use schema defaults.
    return defaults;
  }
  if (isObject(formData)) {
    // Override schema defaults with form data.
    return mergeObjects(defaults, formData);
  }
  return formData || defaults;
}

function getUiOptions(uiSchema) {
  // get all passed options from ui:widget, ui:options, and ui:<optionName>
  return (0, _keys2.default)(uiSchema).filter(function (key) {
    return key.indexOf("ui:") === 0;
  }).reduce(function (options, key) {
    var value = uiSchema[key];

    if (key === "ui:widget" && isObject(value)) {
      console.warn("Setting options via ui:widget object is deprecated, use ui:options instead");
      return (0, _extends4.default)({}, options, value.options || {}, {
        widget: value.component
      });
    }
    if (key === "ui:options" && isObject(value)) {
      return (0, _extends4.default)({}, options, value);
    }
    return (0, _extends4.default)({}, options, (0, _defineProperty3.default)({}, key.substring(3), value));
  }, {});
}

function isObject(thing) {
  return (typeof thing === "undefined" ? "undefined" : (0, _typeof3.default)(thing)) === "object" && thing !== null && !Array.isArray(thing);
}

function mergeObjects(obj1, obj2) {
  var concatArrays = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  // Recursively merge deeply nested objects.
  var acc = (0, _assign2.default)({}, obj1); // Prevent mutation of source object.
  return (0, _keys2.default)(obj2).reduce(function (acc, key) {
    var left = obj1 ? obj1[key] : {},
        right = obj2[key];
    if (obj1 && obj1.hasOwnProperty(key) && isObject(right)) {
      acc[key] = mergeObjects(left, right, concatArrays);
    } else if (concatArrays && Array.isArray(left) && Array.isArray(right)) {
      acc[key] = left.concat(right);
    } else {
      acc[key] = right;
    }
    return acc;
  }, acc);
}

function asNumber(value) {
  if (value === "") {
    return undefined;
  }
  if (/\.$/.test(value)) {
    // "3." can't really be considered a number even if it parses in js. The
    // user is most likely entering a float.
    return value;
  }
  if (/\.0$/.test(value)) {
    // we need to return this as a string here, to allow for input like 3.07
    return value;
  }
  var n = Number(value);
  var valid = typeof n === "number" && !(0, _isNan2.default)(n);

  if (/\.\d*0$/.test(value)) {
    // It's a number, that's cool - but we need it as a string so it doesn't screw
    // with the user when entering dollar amounts or other values (such as those with
    // specific precision or number of significant digits)
    return value;
  }

  return valid ? n : value;
}

function orderProperties(properties, order) {
  if (!Array.isArray(order)) {
    return properties;
  }

  var arrayToHash = function arrayToHash(arr) {
    return arr.reduce(function (prev, curr) {
      prev[curr] = true;
      return prev;
    }, {});
  };
  var errorPropList = function errorPropList(arr) {
    return arr.length > 1 ? "properties '" + arr.join("', '") + "'" : "property '" + arr[0] + "'";
  };
  var propertyHash = arrayToHash(properties);
  var orderHash = arrayToHash(order);
  var extraneous = order.filter(function (prop) {
    return prop !== "*" && !propertyHash[prop];
  });
  if (extraneous.length) {
    throw new Error("uiSchema order list contains extraneous " + errorPropList(extraneous));
  }
  var rest = properties.filter(function (prop) {
    return !orderHash[prop];
  });
  var restIndex = order.indexOf("*");
  if (restIndex === -1) {
    if (rest.length) {
      throw new Error("uiSchema order list does not contain " + errorPropList(rest));
    }
    return order;
  }
  if (restIndex !== order.lastIndexOf("*")) {
    throw new Error("uiSchema order list contains more than one wildcard item");
  }

  var complete = [].concat((0, _toConsumableArray3.default)(order));
  complete.splice.apply(complete, [restIndex, 1].concat((0, _toConsumableArray3.default)(rest)));
  return complete;
}

/**
 * This function checks if the given schema matches a single
 * constant value.
 */
function isConstant(schema) {
  return Array.isArray(schema.enum) && schema.enum.length === 1 || schema.hasOwnProperty("const");
}

function toConstant(schema) {
  if (Array.isArray(schema.enum) && schema.enum.length === 1) {
    return schema.enum[0];
  } else if (schema.hasOwnProperty("const")) {
    return schema.const;
  } else {
    throw new Error("schema cannot be inferred as a constant");
  }
}

function isSelect(_schema) {
  var definitions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var schema = retrieveSchema(_schema, definitions);
  var altSchemas = schema.oneOf || schema.anyOf;
  if (Array.isArray(schema.enum)) {
    return true;
  } else if (Array.isArray(altSchemas)) {
    return altSchemas.every(function (altSchemas) {
      return isConstant(altSchemas);
    });
  }
  return false;
}

function isMultiSelect(schema) {
  var definitions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (!schema.uniqueItems || !schema.items) {
    return false;
  }
  return isSelect(schema.items, definitions);
}

function isFilesArray(schema, uiSchema) {
  var definitions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  if (uiSchema["ui:widget"] === "files") {
    return true;
  } else if (schema.items) {
    var itemsSchema = retrieveSchema(schema.items, definitions);
    return itemsSchema.type === "string" && itemsSchema.format === "data-url";
  }
  return false;
}

function isFixedItems(schema) {
  return Array.isArray(schema.items) && schema.items.length > 0 && schema.items.every(function (item) {
    return isObject(item);
  });
}

function allowAdditionalItems(schema) {
  if (schema.additionalItems === true) {
    console.warn("additionalItems=true is currently not supported");
  }
  return isObject(schema.additionalItems);
}

function optionsList(schema) {
  if (schema.enum) {
    return schema.enum.map(function (value, i) {
      var label = schema.enumNames && schema.enumNames[i] || String(value);
      return { label: label, value: value };
    });
  } else {
    var altSchemas = schema.oneOf || schema.anyOf;
    return altSchemas.map(function (schema, i) {
      var value = toConstant(schema);
      var label = schema.title || String(value);
      return { label: label, value: value };
    });
  }
}

function findSchemaDefinition($ref) {
  var definitions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  // Extract and use the referenced definition if we have it.
  var match = /^#\/definitions\/(.*)$/.exec($ref);
  if (match && match[1]) {
    var parts = match[1].split("/");
    var current = definitions;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _getIterator3.default)(parts), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var part = _step.value;

        part = part.replace(/~1/g, "/").replace(/~0/g, "~");
        if (current.hasOwnProperty(part)) {
          current = current[part];
        } else {
          // No matching definition found, that's an error (bogus schema?)
          throw new Error("Could not find a definition for " + $ref + ".");
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return current;
  }

  // No matching definition found, that's an error (bogus schema?)
  throw new Error("Could not find a definition for " + $ref + ".");
}

// In the case where we have to implicitly create a schema, it is useful to know what type to use
//  based on the data we are defining
var guessType = exports.guessType = function guessType(value) {
  if (Array.isArray(value)) {
    return "array";
  } else if (typeof value === "string") {
    return "string";
  } else if (value == null) {
    return "null";
  } else if (typeof value === "boolean") {
    return "boolean";
  } else if (!isNaN(value)) {
    return "number";
  } else if ((typeof value === "undefined" ? "undefined" : (0, _typeof3.default)(value)) === "object") {
    return "object";
  }
  // Default to string if we can't figure it out
  return "string";
};

// This function will create new "properties" items for each key in our formData
function stubExistingAdditionalProperties(schema) {
  var definitions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var formData = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  // Clone the schema so we don't ruin the consumer's original
  schema = (0, _extends4.default)({}, schema, {
    properties: (0, _extends4.default)({}, schema.properties)
  });
  (0, _keys2.default)(formData).forEach(function (key) {
    if (schema.properties.hasOwnProperty(key)) {
      // No need to stub, our schema already has the property
      return;
    }
    var additionalProperties = schema.additionalProperties.hasOwnProperty("type") ? (0, _extends4.default)({}, schema.additionalProperties) : { type: guessType(formData[key]) };
    // The type of our new key should match the additionalProperties value;
    schema.properties[key] = additionalProperties;
    // Set our additional property flag so we know it was dynamically added
    schema.properties[key][ADDITIONAL_PROPERTY_FLAG] = true;
  });
  return schema;
}

function resolveSchema(schema) {
  var definitions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var formData = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  if (schema.hasOwnProperty("$ref")) {
    return resolveReference(schema, definitions, formData);
  } else if (schema.hasOwnProperty("dependencies")) {
    var resolvedSchema = resolveDependencies(schema, definitions, formData);
    return retrieveSchema(resolvedSchema, definitions, formData);
  } else {
    // No $ref or dependencies attribute found, returning the original schema.
    return schema;
  }
}

function resolveReference(schema, definitions, formData) {
  // Retrieve the referenced schema definition.
  var $refSchema = findSchemaDefinition(schema.$ref, definitions);
  // Drop the $ref property of the source schema.
  var $ref = schema.$ref,
      localSchema = (0, _objectWithoutProperties3.default)(schema, ["$ref"]);
  // Update referenced schema definition with local schema properties.

  return retrieveSchema((0, _extends4.default)({}, $refSchema, localSchema), definitions, formData);
}

function retrieveSchema(schema) {
  var definitions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var formData = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  var resolvedSchema = resolveSchema(schema, definitions, formData);
  var hasAdditionalProperties = resolvedSchema.hasOwnProperty("additionalProperties") && resolvedSchema.additionalProperties !== false;
  if (hasAdditionalProperties) {
    return stubExistingAdditionalProperties(resolvedSchema, definitions, formData);
  }
  return resolvedSchema;
}

function resolveDependencies(schema, definitions, formData) {
  // Drop the dependencies from the source schema.
  var _schema$dependencies = schema.dependencies,
      dependencies = _schema$dependencies === undefined ? {} : _schema$dependencies,
      resolvedSchema = (0, _objectWithoutProperties3.default)(schema, ["dependencies"]);
  // Process dependencies updating the local schema properties as appropriate.

  for (var dependencyKey in dependencies) {
    // Skip this dependency if its trigger property is not present.
    if (formData[dependencyKey] === undefined) {
      continue;
    }
    var dependencyValue = dependencies[dependencyKey];
    if (Array.isArray(dependencyValue)) {
      resolvedSchema = withDependentProperties(resolvedSchema, dependencyValue);
    } else if (isObject(dependencyValue)) {
      resolvedSchema = withDependentSchema(resolvedSchema, definitions, formData, dependencyKey, dependencyValue);
    }
  }
  return resolvedSchema;
}

function withDependentProperties(schema, additionallyRequired) {
  if (!additionallyRequired) {
    return schema;
  }
  var required = Array.isArray(schema.required) ? (0, _from2.default)(new _set2.default([].concat((0, _toConsumableArray3.default)(schema.required), (0, _toConsumableArray3.default)(additionallyRequired)))) : additionallyRequired;
  return (0, _extends4.default)({}, schema, { required: required });
}

function withDependentSchema(schema, definitions, formData, dependencyKey, dependencyValue) {
  var _retrieveSchema = retrieveSchema(dependencyValue, definitions, formData),
      oneOf = _retrieveSchema.oneOf,
      dependentSchema = (0, _objectWithoutProperties3.default)(_retrieveSchema, ["oneOf"]);

  schema = mergeSchemas(schema, dependentSchema);
  // Since it does not contain oneOf, we return the original schema.
  if (oneOf === undefined) {
    return schema;
  } else if (!Array.isArray(oneOf)) {
    throw new Error("invalid: it is some " + (typeof oneOf === "undefined" ? "undefined" : (0, _typeof3.default)(oneOf)) + " instead of an array");
  }
  // Resolve $refs inside oneOf.
  var resolvedOneOf = oneOf.map(function (subschema) {
    return subschema.hasOwnProperty("$ref") ? resolveReference(subschema, definitions, formData) : subschema;
  });
  return withExactlyOneSubschema(schema, definitions, formData, dependencyKey, resolvedOneOf);
}

function withExactlyOneSubschema(schema, definitions, formData, dependencyKey, oneOf) {
  var validSubschemas = oneOf.filter(function (subschema) {
    if (!subschema.properties) {
      return false;
    }
    var conditionPropertySchema = subschema.properties[dependencyKey];

    if (conditionPropertySchema) {
      var conditionSchema = {
        type: "object",
        properties: (0, _defineProperty3.default)({}, dependencyKey, conditionPropertySchema)
      };

      var _validateFormData = (0, _validate2.default)(formData, conditionSchema),
          errors = _validateFormData.errors;

      return errors.length === 0;
    }
  });
  if (validSubschemas.length !== 1) {
    console.warn("ignoring oneOf in dependencies because there isn't exactly one subschema that is valid");
    return schema;
  }
  var subschema = validSubschemas[0];
  var _subschema$properties = subschema.properties,
      conditionPropertySchema = _subschema$properties[dependencyKey],
      dependentSubschema = (0, _objectWithoutProperties3.default)(_subschema$properties, [dependencyKey]);

  var dependentSchema = (0, _extends4.default)({}, subschema, { properties: dependentSubschema });
  return mergeSchemas(schema, retrieveSchema(dependentSchema, definitions, formData));
}

function mergeSchemas(schema1, schema2) {
  return mergeObjects(schema1, schema2, true);
}

function isArguments(object) {
  return Object.prototype.toString.call(object) === "[object Arguments]";
}

function deepEquals(a, b) {
  var ca = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var cb = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

  // Partially extracted from node-deeper and adapted to exclude comparison
  // checks for functions.
  // https://github.com/othiym23/node-deeper
  if (a === b) {
    return true;
  } else if (typeof a === "function" || typeof b === "function") {
    // Assume all functions are equivalent
    // see https://github.com/mozilla-services/react-jsonschema-form/issues/255
    return true;
  } else if ((typeof a === "undefined" ? "undefined" : (0, _typeof3.default)(a)) !== "object" || (typeof b === "undefined" ? "undefined" : (0, _typeof3.default)(b)) !== "object") {
    return false;
  } else if (a === null || b === null) {
    return false;
  } else if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  } else if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.global === b.global && a.multiline === b.multiline && a.lastIndex === b.lastIndex && a.ignoreCase === b.ignoreCase;
  } else if (isArguments(a) || isArguments(b)) {
    if (!(isArguments(a) && isArguments(b))) {
      return false;
    }
    var slice = Array.prototype.slice;
    return deepEquals(slice.call(a), slice.call(b), ca, cb);
  } else {
    if (a.constructor !== b.constructor) {
      return false;
    }

    var ka = (0, _keys2.default)(a);
    var kb = (0, _keys2.default)(b);
    // don't bother with stack acrobatics if there's nothing there
    if (ka.length === 0 && kb.length === 0) {
      return true;
    }
    if (ka.length !== kb.length) {
      return false;
    }

    var cal = ca.length;
    while (cal--) {
      if (ca[cal] === a) {
        return cb[cal] === b;
      }
    }
    ca.push(a);
    cb.push(b);

    ka.sort();
    kb.sort();
    for (var j = ka.length - 1; j >= 0; j--) {
      if (ka[j] !== kb[j]) {
        return false;
      }
    }

    var key = void 0;
    for (var k = ka.length - 1; k >= 0; k--) {
      key = ka[k];
      if (!deepEquals(a[key], b[key], ca, cb)) {
        return false;
      }
    }

    ca.pop();
    cb.pop();

    return true;
  }
}

function shouldRender(comp, nextProps, nextState) {
  var props = comp.props,
      state = comp.state;

  return !deepEquals(props, nextProps) || !deepEquals(state, nextState);
}

function toIdSchema(schema, id, definitions) {
  var formData = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var idPrefix = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : "root";

  var idSchema = {
    $id: id || idPrefix
  };
  if ("$ref" in schema || "dependencies" in schema) {
    var _schema = retrieveSchema(schema, definitions, formData);
    return toIdSchema(_schema, id, definitions, formData, idPrefix);
  }
  if ("items" in schema && !schema.items.$ref) {
    return toIdSchema(schema.items, id, definitions, formData, idPrefix);
  }
  if (schema.type !== "object") {
    return idSchema;
  }
  for (var name in schema.properties || {}) {
    var field = schema.properties[name];
    var fieldId = idSchema.$id + "_" + name;
    idSchema[name] = toIdSchema(field, fieldId, definitions, formData[name], idPrefix);
  }
  return idSchema;
}

function parseDateString(dateString) {
  var includeTime = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

  if (!dateString) {
    return {
      year: -1,
      month: -1,
      day: -1,
      hour: includeTime ? -1 : 0,
      minute: includeTime ? -1 : 0,
      second: includeTime ? -1 : 0
    };
  }
  var date = new Date(dateString);
  if ((0, _isNan2.default)(date.getTime())) {
    throw new Error("Unable to parse date " + dateString);
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1, // oh you, javascript.
    day: date.getUTCDate(),
    hour: includeTime ? date.getUTCHours() : 0,
    minute: includeTime ? date.getUTCMinutes() : 0,
    second: includeTime ? date.getUTCSeconds() : 0
  };
}

function toDateString(_ref2) {
  var year = _ref2.year,
      month = _ref2.month,
      day = _ref2.day,
      _ref2$hour = _ref2.hour,
      hour = _ref2$hour === undefined ? 0 : _ref2$hour,
      _ref2$minute = _ref2.minute,
      minute = _ref2$minute === undefined ? 0 : _ref2$minute,
      _ref2$second = _ref2.second,
      second = _ref2$second === undefined ? 0 : _ref2$second;
  var time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

  var utcTime = Date.UTC(year, month - 1, day, hour, minute, second);
  var datetime = new Date(utcTime).toJSON();
  return time ? datetime : datetime.slice(0, 10);
}

function pad(num, size) {
  var s = String(num);
  while (s.length < size) {
    s = "0" + s;
  }
  return s;
}

function setState(instance, state, callback) {
  var safeRenderCompletion = instance.props.safeRenderCompletion;

  if (safeRenderCompletion) {
    instance.setState(state, callback);
  } else {
    instance.setState(state);
    (0, _setImmediate3.default)(callback);
  }
}

function dataURItoBlob(dataURI) {
  // Split metadata from data
  var splitted = dataURI.split(",");
  // Split params
  var params = splitted[0].split(";");
  // Get mime-type from params
  var type = params[0].replace("data:", "");
  // Filter the name property from params
  var properties = params.filter(function (param) {
    return param.split("=")[0] === "name";
  });
  // Look for the name and use unknown if no name property.
  var name = void 0;
  if (properties.length !== 1) {
    name = "unknown";
  } else {
    // Because we filtered out the other property,
    // we only have the name case here.
    name = properties[0].split("=")[1];
  }

  // Built the Uint8Array Blob parameter from the base64 string.
  var binary = atob(splitted[1]);
  var array = [];
  for (var i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }
  // Create the blob object
  var blob = new window.Blob([new Uint8Array(array)], { type: type });

  return { blob: blob, name: name };
}

function rangeSpec(schema) {
  var spec = {};
  if (schema.multipleOf) {
    spec.step = schema.multipleOf;
  }
  if (schema.minimum || schema.minimum === 0) {
    spec.min = schema.minimum;
  }
  if (schema.maximum || schema.maximum === 0) {
    spec.max = schema.maximum;
  }
  return spec;
}