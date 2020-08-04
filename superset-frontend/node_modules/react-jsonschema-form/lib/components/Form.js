"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

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

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

var _ErrorList = require("./ErrorList");

var _ErrorList2 = _interopRequireDefault(_ErrorList);

var _utils = require("../utils");

var _validate = require("../validate");

var _validate2 = _interopRequireDefault(_validate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Form = function (_Component) {
  (0, _inherits3.default)(Form, _Component);

  function Form(props) {
    (0, _classCallCheck3.default)(this, Form);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Form.__proto__ || (0, _getPrototypeOf2.default)(Form)).call(this, props));

    _this.onChange = function (formData, newErrorSchema) {
      var mustValidate = !_this.props.noValidate && _this.props.liveValidate;
      var state = { formData: formData };
      if (mustValidate) {
        var _this$validate = _this.validate(formData),
            errors = _this$validate.errors,
            errorSchema = _this$validate.errorSchema;

        state = (0, _extends3.default)({}, state, { errors: errors, errorSchema: errorSchema });
      } else if (!_this.props.noValidate && newErrorSchema) {
        state = (0, _extends3.default)({}, state, {
          errorSchema: newErrorSchema,
          errors: (0, _validate.toErrorList)(newErrorSchema)
        });
      }
      (0, _utils.setState)(_this, state, function () {
        if (_this.props.onChange) {
          _this.props.onChange(_this.state);
        }
      });
    };

    _this.onBlur = function () {
      if (_this.props.onBlur) {
        var _this$props;

        (_this$props = _this.props).onBlur.apply(_this$props, arguments);
      }
    };

    _this.onFocus = function () {
      if (_this.props.onFocus) {
        var _this$props2;

        (_this$props2 = _this.props).onFocus.apply(_this$props2, arguments);
      }
    };

    _this.onSubmit = function (event) {
      event.preventDefault();

      if (!_this.props.noValidate) {
        var _this$validate2 = _this.validate(_this.state.formData),
            errors = _this$validate2.errors,
            errorSchema = _this$validate2.errorSchema;

        if ((0, _keys2.default)(errors).length > 0) {
          (0, _utils.setState)(_this, { errors: errors, errorSchema: errorSchema }, function () {
            if (_this.props.onError) {
              _this.props.onError(errors);
            } else {
              console.error("Form validation failed", errors);
            }
          });
          return;
        }
      }

      _this.setState({ errors: [], errorSchema: {} }, function () {
        if (_this.props.onSubmit) {
          _this.props.onSubmit((0, _extends3.default)({}, _this.state, { status: "submitted" }));
        }
      });
    };

    _this.state = _this.getStateFromProps(props);
    if (_this.props.onChange && !(0, _utils.deepEquals)(_this.state.formData, _this.props.formData)) {
      _this.props.onChange(_this.state);
    }
    _this.formElement = null;
    return _this;
  }

  (0, _createClass3.default)(Form, [{
    key: "componentWillReceiveProps",
    value: function componentWillReceiveProps(nextProps) {
      var nextState = this.getStateFromProps(nextProps);
      if (!(0, _utils.deepEquals)(nextState.formData, nextProps.formData) && !(0, _utils.deepEquals)(nextState.formData, this.state.formData) && this.props.onChange) {
        this.props.onChange(nextState);
      }
      this.setState(nextState);
    }
  }, {
    key: "getStateFromProps",
    value: function getStateFromProps(props) {
      var state = this.state || {};
      var schema = "schema" in props ? props.schema : this.props.schema;
      var uiSchema = "uiSchema" in props ? props.uiSchema : this.props.uiSchema;
      var edit = typeof props.formData !== "undefined";
      var liveValidate = props.liveValidate || this.props.liveValidate;
      var mustValidate = edit && !props.noValidate && liveValidate;
      var definitions = schema.definitions;

      var formData = (0, _utils.getDefaultFormState)(schema, props.formData, definitions);
      var retrievedSchema = (0, _utils.retrieveSchema)(schema, definitions, formData);

      var _ref = mustValidate ? this.validate(formData, schema) : {
        errors: state.errors || [],
        errorSchema: state.errorSchema || {}
      },
          errors = _ref.errors,
          errorSchema = _ref.errorSchema;

      var idSchema = (0, _utils.toIdSchema)(retrievedSchema, uiSchema["ui:rootFieldId"], definitions, formData, props.idPrefix);
      return {
        schema: schema,
        uiSchema: uiSchema,
        idSchema: idSchema,
        formData: formData,
        edit: edit,
        errors: errors,
        errorSchema: errorSchema
      };
    }
  }, {
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _utils.shouldRender)(this, nextProps, nextState);
    }
  }, {
    key: "validate",
    value: function validate(formData) {
      var schema = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.props.schema;
      var _props = this.props,
          validate = _props.validate,
          transformErrors = _props.transformErrors;

      var _getRegistry = this.getRegistry(),
          definitions = _getRegistry.definitions;

      var resolvedSchema = (0, _utils.retrieveSchema)(schema, definitions, formData);
      return (0, _validate2.default)(formData, resolvedSchema, validate, transformErrors);
    }
  }, {
    key: "renderErrors",
    value: function renderErrors() {
      var _state = this.state,
          errors = _state.errors,
          errorSchema = _state.errorSchema,
          schema = _state.schema,
          uiSchema = _state.uiSchema;
      var _props2 = this.props,
          ErrorList = _props2.ErrorList,
          showErrorList = _props2.showErrorList,
          formContext = _props2.formContext;


      if (errors.length && showErrorList != false) {
        return _react2.default.createElement(ErrorList, {
          errors: errors,
          errorSchema: errorSchema,
          schema: schema,
          uiSchema: uiSchema,
          formContext: formContext
        });
      }
      return null;
    }
  }, {
    key: "getRegistry",
    value: function getRegistry() {
      // For BC, accept passed SchemaField and TitleField props and pass them to
      // the "fields" registry one.
      var _getDefaultRegistry = (0, _utils.getDefaultRegistry)(),
          fields = _getDefaultRegistry.fields,
          widgets = _getDefaultRegistry.widgets;

      return {
        fields: (0, _extends3.default)({}, fields, this.props.fields),
        widgets: (0, _extends3.default)({}, widgets, this.props.widgets),
        ArrayFieldTemplate: this.props.ArrayFieldTemplate,
        ObjectFieldTemplate: this.props.ObjectFieldTemplate,
        FieldTemplate: this.props.FieldTemplate,
        definitions: this.props.schema.definitions || {},
        formContext: this.props.formContext || {}
      };
    }
  }, {
    key: "submit",
    value: function submit() {
      if (this.formElement) {
        this.formElement.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
  }, {
    key: "render",
    value: function render() {
      var _this2 = this;

      var _props3 = this.props,
          children = _props3.children,
          safeRenderCompletion = _props3.safeRenderCompletion,
          id = _props3.id,
          idPrefix = _props3.idPrefix,
          className = _props3.className,
          name = _props3.name,
          method = _props3.method,
          target = _props3.target,
          action = _props3.action,
          autocomplete = _props3.autocomplete,
          enctype = _props3.enctype,
          acceptcharset = _props3.acceptcharset,
          noHtml5Validate = _props3.noHtml5Validate,
          disabled = _props3.disabled;
      var _state2 = this.state,
          schema = _state2.schema,
          uiSchema = _state2.uiSchema,
          formData = _state2.formData,
          errorSchema = _state2.errorSchema,
          idSchema = _state2.idSchema;

      var registry = this.getRegistry();
      var _SchemaField = registry.fields.SchemaField;

      return _react2.default.createElement(
        "form",
        {
          className: className ? className : "rjsf",
          id: id,
          name: name,
          method: method,
          target: target,
          action: action,
          autoComplete: autocomplete,
          encType: enctype,
          acceptCharset: acceptcharset,
          noValidate: noHtml5Validate,
          onSubmit: this.onSubmit,
          ref: function ref(form) {
            _this2.formElement = form;
          } },
        this.renderErrors(),
        _react2.default.createElement(_SchemaField, {
          schema: schema,
          uiSchema: uiSchema,
          errorSchema: errorSchema,
          idSchema: idSchema,
          idPrefix: idPrefix,
          formData: formData,
          onChange: this.onChange,
          onBlur: this.onBlur,
          onFocus: this.onFocus,
          registry: registry,
          safeRenderCompletion: safeRenderCompletion,
          disabled: disabled
        }),
        children ? children : _react2.default.createElement(
          "p",
          null,
          _react2.default.createElement(
            "button",
            { type: "submit", className: "btn btn-info" },
            "Submit"
          )
        )
      );
    }
  }]);
  return Form;
}(_react.Component);

Form.defaultProps = {
  uiSchema: {},
  noValidate: false,
  liveValidate: false,
  disabled: false,
  safeRenderCompletion: false,
  noHtml5Validate: false,
  ErrorList: _ErrorList2.default
};
exports.default = Form;


if (process.env.NODE_ENV !== "production") {
  Form.propTypes = {
    schema: _propTypes2.default.object.isRequired,
    uiSchema: _propTypes2.default.object,
    formData: _propTypes2.default.any,
    widgets: _propTypes2.default.objectOf(_propTypes2.default.oneOfType([_propTypes2.default.func, _propTypes2.default.object])),
    fields: _propTypes2.default.objectOf(_propTypes2.default.func),
    ArrayFieldTemplate: _propTypes2.default.func,
    ObjectFieldTemplate: _propTypes2.default.func,
    FieldTemplate: _propTypes2.default.func,
    ErrorList: _propTypes2.default.func,
    onChange: _propTypes2.default.func,
    onError: _propTypes2.default.func,
    showErrorList: _propTypes2.default.bool,
    onSubmit: _propTypes2.default.func,
    id: _propTypes2.default.string,
    className: _propTypes2.default.string,
    name: _propTypes2.default.string,
    method: _propTypes2.default.string,
    target: _propTypes2.default.string,
    action: _propTypes2.default.string,
    autocomplete: _propTypes2.default.string,
    enctype: _propTypes2.default.string,
    acceptcharset: _propTypes2.default.string,
    noValidate: _propTypes2.default.bool,
    noHtml5Validate: _propTypes2.default.bool,
    liveValidate: _propTypes2.default.bool,
    validate: _propTypes2.default.func,
    transformErrors: _propTypes2.default.func,
    safeRenderCompletion: _propTypes2.default.bool,
    formContext: _propTypes2.default.object
  };
}