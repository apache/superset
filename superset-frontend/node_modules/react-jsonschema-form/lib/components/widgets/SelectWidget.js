"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _set = require("babel-runtime/core-js/set");

var _set2 = _interopRequireDefault(_set);

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

var _utils = require("../../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var nums = new _set2.default(["number", "integer"]);

/**
 * This is a silly limitation in the DOM where option change event values are
 * always retrieved as strings.
 */
function processValue(schema, value) {
  // "enum" is a reserved word, so only "type" and "items" can be destructured
  var type = schema.type,
      items = schema.items;

  if (value === "") {
    return undefined;
  } else if (type === "array" && items && nums.has(items.type)) {
    return value.map(_utils.asNumber);
  } else if (type === "boolean") {
    return value === "true";
  } else if (type === "number") {
    return (0, _utils.asNumber)(value);
  }

  // If type is undefined, but an enum is present, try and infer the type from
  // the enum values
  if (schema.enum) {
    if (schema.enum.every(function (x) {
      return (0, _utils.guessType)(x) === "number";
    })) {
      return (0, _utils.asNumber)(value);
    } else if (schema.enum.every(function (x) {
      return (0, _utils.guessType)(x) === "boolean";
    })) {
      return value === "true";
    }
  }

  return value;
}

function getValue(event, multiple) {
  if (multiple) {
    return [].slice.call(event.target.options).filter(function (o) {
      return o.selected;
    }).map(function (o) {
      return o.value;
    });
  } else {
    return event.target.value;
  }
}

function SelectWidget(props) {
  var schema = props.schema,
      id = props.id,
      options = props.options,
      value = props.value,
      required = props.required,
      disabled = props.disabled,
      readonly = props.readonly,
      multiple = props.multiple,
      autofocus = props.autofocus,
      _onChange = props.onChange,
      onBlur = props.onBlur,
      onFocus = props.onFocus,
      placeholder = props.placeholder;
  var enumOptions = options.enumOptions,
      enumDisabled = options.enumDisabled;

  var emptyValue = multiple ? [] : "";
  return _react2.default.createElement(
    "select",
    {
      id: id,
      multiple: multiple,
      className: "form-control",
      value: typeof value === "undefined" ? emptyValue : value,
      required: required,
      disabled: disabled || readonly,
      autoFocus: autofocus,
      onBlur: onBlur && function (event) {
        var newValue = getValue(event, multiple);
        onBlur(id, processValue(schema, newValue));
      },
      onFocus: onFocus && function (event) {
        var newValue = getValue(event, multiple);
        onFocus(id, processValue(schema, newValue));
      },
      onChange: function onChange(event) {
        var newValue = getValue(event, multiple);
        _onChange(processValue(schema, newValue));
      } },
    !multiple && !schema.default && _react2.default.createElement(
      "option",
      { value: "" },
      placeholder
    ),
    enumOptions.map(function (_ref, i) {
      var value = _ref.value,
          label = _ref.label;

      var disabled = enumDisabled && enumDisabled.indexOf(value) != -1;
      return _react2.default.createElement(
        "option",
        { key: i, value: value, disabled: disabled },
        label
      );
    })
  );
}

SelectWidget.defaultProps = {
  autofocus: false
};

if (process.env.NODE_ENV !== "production") {
  SelectWidget.propTypes = {
    schema: _propTypes2.default.object.isRequired,
    id: _propTypes2.default.string.isRequired,
    options: _propTypes2.default.shape({
      enumOptions: _propTypes2.default.array
    }).isRequired,
    value: _propTypes2.default.any,
    required: _propTypes2.default.bool,
    disabled: _propTypes2.default.bool,
    readonly: _propTypes2.default.bool,
    multiple: _propTypes2.default.bool,
    autofocus: _propTypes2.default.bool,
    onChange: _propTypes2.default.func,
    onBlur: _propTypes2.default.func,
    onFocus: _propTypes2.default.func
  };
}

exports.default = SelectWidget;