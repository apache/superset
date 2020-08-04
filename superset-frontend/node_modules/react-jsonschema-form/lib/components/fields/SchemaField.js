"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getPrototypeOf = require("babel-runtime/core-js/object/get-prototype-of");

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require("babel-runtime/helpers/inherits");

var _inherits3 = _interopRequireDefault(_inherits2);

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

var _objectWithoutProperties2 = require("babel-runtime/helpers/objectWithoutProperties");

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

var _utils = require("../../utils");

var _IconButton = require("../IconButton");

var _IconButton2 = _interopRequireDefault(_IconButton);

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

var _types = require("../../types");

var types = _interopRequireWildcard(_types);

var _UnsupportedField = require("./UnsupportedField");

var _UnsupportedField2 = _interopRequireDefault(_UnsupportedField);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var REQUIRED_FIELD_SYMBOL = "*";
var COMPONENT_TYPES = {
  array: "ArrayField",
  boolean: "BooleanField",
  integer: "NumberField",
  number: "NumberField",
  object: "ObjectField",
  string: "StringField"
};

function getFieldComponent(schema, uiSchema, idSchema, fields) {
  var field = uiSchema["ui:field"];
  if (typeof field === "function") {
    return field;
  }
  if (typeof field === "string" && field in fields) {
    return fields[field];
  }

  var componentName = COMPONENT_TYPES[(0, _utils.getSchemaType)(schema)];

  // If the type is not defined and the schema uses 'anyOf', don't render
  // a field and let the AnyOfField component handle the form display
  if (!componentName && schema.anyOf) {
    return function () {
      return null;
    };
  }

  return componentName in fields ? fields[componentName] : function () {
    return _react2.default.createElement(_UnsupportedField2.default, {
      schema: schema,
      idSchema: idSchema,
      reason: "Unknown field type " + schema.type
    });
  };
}

function Label(props) {
  var label = props.label,
      required = props.required,
      id = props.id;

  if (!label) {
    // See #312: Ensure compatibility with old versions of React.
    return _react2.default.createElement("div", null);
  }
  return _react2.default.createElement(
    "label",
    { className: "control-label", htmlFor: id },
    label,
    required && _react2.default.createElement(
      "span",
      { className: "required" },
      REQUIRED_FIELD_SYMBOL
    )
  );
}

function LabelInput(props) {
  var id = props.id,
      label = props.label,
      onChange = props.onChange;

  return _react2.default.createElement("input", {
    className: "form-control",
    type: "text",
    id: id,
    onBlur: function onBlur(event) {
      return onChange(event.target.value);
    },
    defaultValue: label
  });
}

function Help(props) {
  var help = props.help;

  if (!help) {
    // See #312: Ensure compatibility with old versions of React.
    return _react2.default.createElement("div", null);
  }
  if (typeof help === "string") {
    return _react2.default.createElement(
      "p",
      { className: "help-block" },
      help
    );
  }
  return _react2.default.createElement(
    "div",
    { className: "help-block" },
    help
  );
}

function ErrorList(props) {
  var _props$errors = props.errors,
      errors = _props$errors === undefined ? [] : _props$errors;

  if (errors.length === 0) {
    return _react2.default.createElement("div", null);
  }
  return _react2.default.createElement(
    "div",
    null,
    _react2.default.createElement("p", null),
    _react2.default.createElement(
      "ul",
      { className: "error-detail bs-callout bs-callout-info" },
      errors.map(function (error, index) {
        return _react2.default.createElement(
          "li",
          { className: "text-danger", key: index },
          error
        );
      })
    )
  );
}
function DefaultTemplate(props) {
  var id = props.id,
      classNames = props.classNames,
      label = props.label,
      children = props.children,
      errors = props.errors,
      help = props.help,
      description = props.description,
      hidden = props.hidden,
      required = props.required,
      displayLabel = props.displayLabel,
      onKeyChange = props.onKeyChange,
      onDropPropertyClick = props.onDropPropertyClick;

  if (hidden) {
    return _react2.default.createElement(
      "div",
      { className: "hidden" },
      children
    );
  }

  var additional = props.schema.hasOwnProperty(_utils.ADDITIONAL_PROPERTY_FLAG);
  var keyLabel = label + " Key";

  return _react2.default.createElement(
    "div",
    { className: classNames },
    _react2.default.createElement(
      "div",
      { className: additional ? "row" : "" },
      additional && _react2.default.createElement(
        "div",
        { className: "col-xs-5 form-additional" },
        _react2.default.createElement(
          "div",
          { className: "form-group" },
          _react2.default.createElement(Label, { label: keyLabel, required: required, id: id + "-key" }),
          _react2.default.createElement(LabelInput, {
            label: label,
            required: required,
            id: id + "-key",
            onChange: onKeyChange
          })
        )
      ),
      _react2.default.createElement(
        "div",
        {
          className: additional ? "form-additional form-group col-xs-5" : "" },
        displayLabel && _react2.default.createElement(Label, { label: label, required: required, id: id }),
        displayLabel && description ? description : null,
        children,
        errors,
        help
      ),
      _react2.default.createElement(
        "div",
        { className: "col-xs-2" },
        additional && _react2.default.createElement(_IconButton2.default, {
          type: "danger",
          icon: "remove",
          className: "array-item-remove btn-block",
          tabIndex: "-1",
          style: { border: "0" },
          disabled: props.disabled || props.readonly,
          onClick: onDropPropertyClick(props.label)
        })
      )
    )
  );
}
if (process.env.NODE_ENV !== "production") {
  DefaultTemplate.propTypes = {
    id: _propTypes2.default.string,
    classNames: _propTypes2.default.string,
    label: _propTypes2.default.string,
    children: _propTypes2.default.node.isRequired,
    errors: _propTypes2.default.element,
    rawErrors: _propTypes2.default.arrayOf(_propTypes2.default.string),
    help: _propTypes2.default.element,
    rawHelp: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.element]),
    description: _propTypes2.default.element,
    rawDescription: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.element]),
    hidden: _propTypes2.default.bool,
    required: _propTypes2.default.bool,
    readonly: _propTypes2.default.bool,
    displayLabel: _propTypes2.default.bool,
    fields: _propTypes2.default.object,
    formContext: _propTypes2.default.object
  };
}

DefaultTemplate.defaultProps = {
  hidden: false,
  readonly: false,
  required: false,
  displayLabel: true
};

function SchemaFieldRender(props) {
  var uiSchema = props.uiSchema,
      formData = props.formData,
      errorSchema = props.errorSchema,
      idPrefix = props.idPrefix,
      name = props.name,
      onKeyChange = props.onKeyChange,
      onDropPropertyClick = props.onDropPropertyClick,
      required = props.required,
      _props$registry = props.registry,
      registry = _props$registry === undefined ? (0, _utils.getDefaultRegistry)() : _props$registry;
  var definitions = registry.definitions,
      fields = registry.fields,
      formContext = registry.formContext,
      _registry$FieldTempla = registry.FieldTemplate,
      FieldTemplate = _registry$FieldTempla === undefined ? DefaultTemplate : _registry$FieldTempla;

  var idSchema = props.idSchema;
  var schema = (0, _utils.retrieveSchema)(props.schema, definitions, formData);
  idSchema = (0, _utils.mergeObjects)((0, _utils.toIdSchema)(schema, null, definitions, formData, idPrefix), idSchema);
  var FieldComponent = getFieldComponent(schema, uiSchema, idSchema, fields);
  var DescriptionField = fields.DescriptionField;

  var disabled = Boolean(props.disabled || uiSchema["ui:disabled"]);
  var readonly = Boolean(props.readonly || uiSchema["ui:readonly"]);
  var autofocus = Boolean(props.autofocus || uiSchema["ui:autofocus"]);

  if ((0, _keys2.default)(schema).length === 0) {
    // See #312: Ensure compatibility with old versions of React.
    return _react2.default.createElement("div", null);
  }

  var uiOptions = (0, _utils.getUiOptions)(uiSchema);
  var _uiOptions$label = uiOptions.label,
      displayLabel = _uiOptions$label === undefined ? true : _uiOptions$label;

  if (schema.type === "array") {
    displayLabel = (0, _utils.isMultiSelect)(schema, definitions) || (0, _utils.isFilesArray)(schema, uiSchema, definitions);
  }
  if (schema.type === "object") {
    displayLabel = false;
  }
  if (schema.type === "boolean" && !uiSchema["ui:widget"]) {
    displayLabel = false;
  }
  if (uiSchema["ui:field"]) {
    displayLabel = false;
  }

  var __errors = errorSchema.__errors,
      fieldErrorSchema = (0, _objectWithoutProperties3.default)(errorSchema, ["__errors"]);

  // See #439: uiSchema: Don't pass consumed class names to child components

  var field = _react2.default.createElement(FieldComponent, (0, _extends3.default)({}, props, {
    idSchema: idSchema,
    schema: schema,
    uiSchema: (0, _extends3.default)({}, uiSchema, { classNames: undefined }),
    disabled: disabled,
    readonly: readonly,
    autofocus: autofocus,
    errorSchema: fieldErrorSchema,
    formContext: formContext,
    rawErrors: __errors
  }));

  var type = schema.type;

  var id = idSchema.$id;
  var label = uiSchema["ui:title"] || props.schema.title || schema.title || name;
  var description = uiSchema["ui:description"] || props.schema.description || schema.description;
  var errors = __errors;
  var help = uiSchema["ui:help"];
  var hidden = uiSchema["ui:widget"] === "hidden";
  var classNames = ["form-group", "field", "field-" + type, errors && errors.length > 0 ? "field-error has-error has-danger" : "", uiSchema.classNames].join(" ").trim();

  var fieldProps = {
    description: _react2.default.createElement(DescriptionField, {
      id: id + "__description",
      description: description,
      formContext: formContext
    }),
    rawDescription: description,
    help: _react2.default.createElement(Help, { help: help }),
    rawHelp: typeof help === "string" ? help : undefined,
    errors: _react2.default.createElement(ErrorList, { errors: errors }),
    rawErrors: errors,
    id: id,
    label: label,
    hidden: hidden,
    onKeyChange: onKeyChange,
    onDropPropertyClick: onDropPropertyClick,
    required: required,
    disabled: disabled,
    readonly: readonly,
    displayLabel: displayLabel,
    classNames: classNames,
    formContext: formContext,
    fields: fields,
    schema: schema,
    uiSchema: uiSchema
  };

  var _AnyOfField = registry.fields.AnyOfField;

  return _react2.default.createElement(
    FieldTemplate,
    fieldProps,
    field,
    schema.anyOf && !(0, _utils.isSelect)(schema) && _react2.default.createElement(_AnyOfField, {
      disabled: disabled,
      errorSchema: errorSchema,
      formData: formData,
      idPrefix: idPrefix,
      idSchema: idSchema,
      onBlur: props.onBlur,
      onChange: props.onChange,
      onFocus: props.onFocus,
      schema: schema,
      registry: registry,
      safeRenderCompletion: props.safeRenderCompletion,
      uiSchema: uiSchema
    })
  );
}

var SchemaField = function (_React$Component) {
  (0, _inherits3.default)(SchemaField, _React$Component);

  function SchemaField() {
    (0, _classCallCheck3.default)(this, SchemaField);
    return (0, _possibleConstructorReturn3.default)(this, (SchemaField.__proto__ || (0, _getPrototypeOf2.default)(SchemaField)).apply(this, arguments));
  }

  (0, _createClass3.default)(SchemaField, [{
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate(nextProps, nextState) {
      // if schemas are equal idSchemas will be equal as well,
      // so it is not necessary to compare
      return !(0, _utils.deepEquals)((0, _extends3.default)({}, this.props, { idSchema: undefined }), (0, _extends3.default)({}, nextProps, { idSchema: undefined }));
    }
  }, {
    key: "render",
    value: function render() {
      return SchemaFieldRender(this.props);
    }
  }]);
  return SchemaField;
}(_react2.default.Component);

SchemaField.defaultProps = {
  uiSchema: {},
  errorSchema: {},
  idSchema: {},
  disabled: false,
  readonly: false,
  autofocus: false
};

if (process.env.NODE_ENV !== "production") {
  SchemaField.propTypes = {
    schema: _propTypes2.default.object.isRequired,
    uiSchema: _propTypes2.default.object,
    idSchema: _propTypes2.default.object,
    formData: _propTypes2.default.any,
    errorSchema: _propTypes2.default.object,
    registry: types.registry.isRequired
  };
}

exports.default = SchemaField;