"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _stringify = require("babel-runtime/core-js/json/stringify");

var _stringify2 = _interopRequireDefault(_stringify);

var _assign = require("babel-runtime/core-js/object/assign");

var _assign2 = _interopRequireDefault(_assign);

var _toConsumableArray2 = require("babel-runtime/helpers/toConsumableArray");

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _defineProperty2 = require("babel-runtime/helpers/defineProperty");

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _extends5 = require("babel-runtime/helpers/extends");

var _extends6 = _interopRequireDefault(_extends5);

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

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

var _AddButton = require("../AddButton");

var _AddButton2 = _interopRequireDefault(_AddButton);

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _types = require("../../types");

var types = _interopRequireWildcard(_types);

var _utils = require("../../utils");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function DefaultObjectFieldTemplate(props) {
  var canExpand = function canExpand() {
    var formData = props.formData,
        schema = props.schema,
        uiSchema = props.uiSchema;

    if (!schema.additionalProperties) {
      return false;
    }

    var _getUiOptions = (0, _utils.getUiOptions)(uiSchema),
        expandable = _getUiOptions.expandable;

    if (expandable === false) {
      return expandable;
    }
    // if ui:options.expandable was not explicitly set to false, we can add
    // another property if we have not exceeded maxProperties yet
    if (schema.maxProperties !== undefined) {
      return (0, _keys2.default)(formData).length < schema.maxProperties;
    }
    return true;
  };

  var TitleField = props.TitleField,
      DescriptionField = props.DescriptionField;

  return _react2.default.createElement(
    "fieldset",
    { id: props.idSchema.$id },
    (props.uiSchema["ui:title"] || props.title) && _react2.default.createElement(TitleField, {
      id: props.idSchema.$id + "__title",
      title: props.title || props.uiSchema["ui:title"],
      required: props.required,
      formContext: props.formContext
    }),
    props.description && _react2.default.createElement(DescriptionField, {
      id: props.idSchema.$id + "__description",
      description: props.description,
      formContext: props.formContext
    }),
    props.properties.map(function (prop) {
      return prop.content;
    }),
    canExpand() && _react2.default.createElement(_AddButton2.default, {
      className: "object-property-expand",
      onClick: props.onAddClick(props.schema),
      disabled: props.disabled || props.readonly
    })
  );
}

var ObjectField = function (_Component) {
  (0, _inherits3.default)(ObjectField, _Component);

  function ObjectField() {
    var _ref;

    var _temp, _this, _ret;

    (0, _classCallCheck3.default)(this, ObjectField);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = (0, _possibleConstructorReturn3.default)(this, (_ref = ObjectField.__proto__ || (0, _getPrototypeOf2.default)(ObjectField)).call.apply(_ref, [this].concat(args))), _this), _this.state = {
      additionalProperties: {}
    }, _this.onPropertyChange = function (name) {
      var addedByAdditionalProperties = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      return function (value, errorSchema) {
        if (!value && addedByAdditionalProperties) {
          // Don't set value = undefined for fields added by
          // additionalProperties. Doing so removes them from the
          // formData, which causes them to completely disappear
          // (including the input field for the property name). Unlike
          // fields which are "mandated" by the schema, these fields can
          // be set to undefined by clicking a "delete field" button, so
          // set empty values to the empty string.
          value = "";
        }
        var newFormData = (0, _extends6.default)({}, _this.props.formData, (0, _defineProperty3.default)({}, name, value));
        _this.props.onChange(newFormData, errorSchema && _this.props.errorSchema && (0, _extends6.default)({}, _this.props.errorSchema, (0, _defineProperty3.default)({}, name, errorSchema)));
      };
    }, _this.onDropPropertyClick = function (key) {
      return function (event) {
        event.preventDefault();
        var _this$props = _this.props,
            onChange = _this$props.onChange,
            formData = _this$props.formData;

        var copiedFormData = (0, _extends6.default)({}, formData);
        delete copiedFormData[key];
        onChange(copiedFormData);
      };
    }, _this.getAvailableKey = function (preferredKey, formData) {
      var index = 0;
      var newKey = preferredKey;
      while (formData.hasOwnProperty(newKey)) {
        newKey = preferredKey + "-" + ++index;
      }
      return newKey;
    }, _this.onKeyChange = function (oldValue) {
      return function (value, errorSchema) {
        if (oldValue === value) {
          return;
        }
        value = _this.getAvailableKey(value, _this.props.formData);
        var newFormData = (0, _extends6.default)({}, _this.props.formData);
        var newKeys = (0, _defineProperty3.default)({}, oldValue, value);
        var keyValues = (0, _keys2.default)(newFormData).map(function (key) {
          var newKey = newKeys[key] || key;
          return (0, _defineProperty3.default)({}, newKey, newFormData[key]);
        });
        var renamedObj = _assign2.default.apply(Object, [{}].concat((0, _toConsumableArray3.default)(keyValues)));
        _this.props.onChange(renamedObj, errorSchema && _this.props.errorSchema && (0, _extends6.default)({}, _this.props.errorSchema, (0, _defineProperty3.default)({}, value, errorSchema)));
      };
    }, _this.handleAddClick = function (schema) {
      return function () {
        var type = schema.additionalProperties.type;
        var newFormData = (0, _extends6.default)({}, _this.props.formData);
        newFormData[_this.getAvailableKey("newKey", newFormData)] = _this.getDefaultValue(type);
        _this.props.onChange(newFormData);
      };
    }, _temp), (0, _possibleConstructorReturn3.default)(_this, _ret);
  }

  (0, _createClass3.default)(ObjectField, [{
    key: "isRequired",
    value: function isRequired(name) {
      var schema = this.props.schema;
      return Array.isArray(schema.required) && schema.required.indexOf(name) !== -1;
    }
  }, {
    key: "getDefaultValue",
    value: function getDefaultValue(type) {
      switch (type) {
        case "string":
          return "New Value";
        case "array":
          return [];
        case "boolean":
          return false;
        case "null":
          return null;
        case "number":
          return 0;
        case "object":
          return {};
        default:
          // We don't have a datatype for some reason (perhaps additionalProperties was true)
          return "New Value";
      }
    }
  }, {
    key: "render",
    value: function render() {
      var _this2 = this;

      var _props = this.props,
          uiSchema = _props.uiSchema,
          formData = _props.formData,
          errorSchema = _props.errorSchema,
          idSchema = _props.idSchema,
          name = _props.name,
          required = _props.required,
          disabled = _props.disabled,
          readonly = _props.readonly,
          idPrefix = _props.idPrefix,
          onBlur = _props.onBlur,
          onFocus = _props.onFocus,
          _props$registry = _props.registry,
          registry = _props$registry === undefined ? (0, _utils.getDefaultRegistry)() : _props$registry;
      var definitions = registry.definitions,
          fields = registry.fields,
          formContext = registry.formContext;
      var SchemaField = fields.SchemaField,
          TitleField = fields.TitleField,
          DescriptionField = fields.DescriptionField;

      var schema = (0, _utils.retrieveSchema)(this.props.schema, definitions, formData);
      var title = schema.title === undefined ? name : schema.title;
      var description = uiSchema["ui:description"] || schema.description;
      var orderedProperties = void 0;
      try {
        var properties = (0, _keys2.default)(schema.properties || {});
        orderedProperties = (0, _utils.orderProperties)(properties, uiSchema["ui:order"]);
      } catch (err) {
        return _react2.default.createElement(
          "div",
          null,
          _react2.default.createElement(
            "p",
            { className: "config-error", style: { color: "red" } },
            "Invalid ",
            name || "root",
            " object field configuration:",
            _react2.default.createElement(
              "em",
              null,
              err.message
            ),
            "."
          ),
          _react2.default.createElement(
            "pre",
            null,
            (0, _stringify2.default)(schema)
          )
        );
      }

      var Template = registry.ObjectFieldTemplate || DefaultObjectFieldTemplate;

      var templateProps = {
        title: uiSchema["ui:title"] || title,
        description: description,
        TitleField: TitleField,
        DescriptionField: DescriptionField,
        properties: orderedProperties.map(function (name) {
          var addedByAdditionalProperties = schema.properties[name].hasOwnProperty(_utils.ADDITIONAL_PROPERTY_FLAG);
          return {
            content: _react2.default.createElement(SchemaField, {
              key: name,
              name: name,
              required: _this2.isRequired(name),
              schema: schema.properties[name],
              uiSchema: uiSchema[name],
              errorSchema: errorSchema[name],
              idSchema: idSchema[name],
              idPrefix: idPrefix,
              formData: formData[name],
              onKeyChange: _this2.onKeyChange(name),
              onChange: _this2.onPropertyChange(name, addedByAdditionalProperties),
              onBlur: onBlur,
              onFocus: onFocus,
              registry: registry,
              disabled: disabled,
              readonly: readonly,
              onDropPropertyClick: _this2.onDropPropertyClick
            }),
            name: name,
            readonly: readonly,
            disabled: disabled,
            required: required
          };
        }),
        readonly: readonly,
        disabled: disabled,
        required: required,
        idSchema: idSchema,
        uiSchema: uiSchema,
        schema: schema,
        formData: formData,
        formContext: formContext
      };
      return _react2.default.createElement(Template, (0, _extends6.default)({}, templateProps, { onAddClick: this.handleAddClick }));
    }
  }]);
  return ObjectField;
}(_react.Component);

ObjectField.defaultProps = {
  uiSchema: {},
  formData: {},
  errorSchema: {},
  idSchema: {},
  required: false,
  disabled: false,
  readonly: false
};


if (process.env.NODE_ENV !== "production") {
  ObjectField.propTypes = types.fieldProps;
}

exports.default = ObjectField;