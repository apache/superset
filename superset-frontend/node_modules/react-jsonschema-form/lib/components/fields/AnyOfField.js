"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getIterator2 = require("babel-runtime/core-js/get-iterator");

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _assign = require("babel-runtime/core-js/object/assign");

var _assign2 = _interopRequireDefault(_assign);

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

var _types = require("../../types");

var types = _interopRequireWildcard(_types);

var _utils = require("../../utils");

var _validate = require("../../validate");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var AnyOfField = function (_Component) {
  (0, _inherits3.default)(AnyOfField, _Component);

  function AnyOfField(props) {
    (0, _classCallCheck3.default)(this, AnyOfField);

    var _this = (0, _possibleConstructorReturn3.default)(this, (AnyOfField.__proto__ || (0, _getPrototypeOf2.default)(AnyOfField)).call(this, props));

    _initialiseProps.call(_this);

    var _this$props = _this.props,
        formData = _this$props.formData,
        schema = _this$props.schema;


    _this.state = {
      selectedOption: _this.getMatchingOption(formData, schema.anyOf)
    };
    return _this;
  }

  (0, _createClass3.default)(AnyOfField, [{
    key: "componentWillReceiveProps",
    value: function componentWillReceiveProps(nextProps) {
      var matchingOption = this.getMatchingOption(nextProps.formData, nextProps.schema.anyOf);

      if (matchingOption === this.state.selectedOption) {
        return;
      }

      this.setState({ selectedOption: matchingOption });
    }
  }, {
    key: "getMatchingOption",
    value: function getMatchingOption(formData, options) {
      for (var i = 0; i < options.length; i++) {
        if ((0, _validate.isValid)(options[i], formData)) {
          return i;
        }
      }

      // If the form data matches none of the options, use the first option
      return 0;
    }
  }, {
    key: "render",
    value: function render() {
      var _props = this.props,
          disabled = _props.disabled,
          errorSchema = _props.errorSchema,
          formData = _props.formData,
          idPrefix = _props.idPrefix,
          idSchema = _props.idSchema,
          onBlur = _props.onBlur,
          onChange = _props.onChange,
          onFocus = _props.onFocus,
          schema = _props.schema,
          registry = _props.registry,
          safeRenderCompletion = _props.safeRenderCompletion,
          uiSchema = _props.uiSchema;


      var _SchemaField = registry.fields.SchemaField;
      var selectedOption = this.state.selectedOption;


      var baseType = schema.type;
      var options = schema.anyOf || [];
      var option = options[selectedOption] || null;
      var optionSchema = void 0;

      if (option) {
        // If the subschema doesn't declare a type, infer the type from the
        // parent schema
        optionSchema = option.type ? option : (0, _assign2.default)({}, option, { type: baseType });
      }

      return _react2.default.createElement(
        "div",
        { className: "panel panel-default panel-body" },
        _react2.default.createElement(
          "div",
          { className: "form-group" },
          _react2.default.createElement(
            "select",
            {
              className: "form-control",
              onChange: this.onOptionChange,
              value: selectedOption,
              id: idSchema.$id + "_anyof_select" },
            options.map(function (option, index) {
              return _react2.default.createElement(
                "option",
                { key: index, value: index },
                option.title || "Option " + (index + 1)
              );
            })
          )
        ),
        option !== null && _react2.default.createElement(_SchemaField, {
          schema: optionSchema,
          uiSchema: uiSchema,
          errorSchema: errorSchema,
          idSchema: idSchema,
          idPrefix: idPrefix,
          formData: formData,
          onChange: onChange,
          onBlur: onBlur,
          onFocus: onFocus,
          registry: registry,
          safeRenderCompletion: safeRenderCompletion,
          disabled: disabled
        })
      );
    }
  }]);
  return AnyOfField;
}(_react.Component);

var _initialiseProps = function _initialiseProps() {
  var _this2 = this;

  this.onOptionChange = function (event) {
    var selectedOption = parseInt(event.target.value, 10);
    var _props2 = _this2.props,
        formData = _props2.formData,
        onChange = _props2.onChange,
        schema = _props2.schema;

    var options = schema.anyOf;

    if ((0, _utils.guessType)(formData) === "object") {
      var newFormData = (0, _assign2.default)({}, formData);

      var optionsToDiscard = options.slice();
      optionsToDiscard.splice(selectedOption, 1);

      // Discard any data added using other options
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = (0, _getIterator3.default)(optionsToDiscard), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var option = _step.value;

          if (option.properties) {
            for (var key in option.properties) {
              if (newFormData.hasOwnProperty(key)) {
                delete newFormData[key];
              }
            }
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

      onChange(newFormData);
    } else {
      onChange(undefined);
    }

    _this2.setState({
      selectedOption: parseInt(event.target.value, 10)
    });
  };
};

AnyOfField.defaultProps = {
  disabled: false,
  errorSchema: {},
  idSchema: {},
  uiSchema: {}
};

if (process.env.NODE_ENV !== "production") {
  AnyOfField.propTypes = {
    schema: _propTypes2.default.object.isRequired,
    uiSchema: _propTypes2.default.object,
    idSchema: _propTypes2.default.object,
    formData: _propTypes2.default.any,
    errorSchema: _propTypes2.default.object,
    registry: types.registry.isRequired
  };
}

exports.default = AnyOfField;