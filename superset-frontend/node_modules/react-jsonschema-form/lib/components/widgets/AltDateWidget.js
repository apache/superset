"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

var _defineProperty2 = require("babel-runtime/helpers/defineProperty");

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

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

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

var _utils = require("../../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function rangeOptions(start, stop) {
  var options = [];
  for (var i = start; i <= stop; i++) {
    options.push({ value: i, label: (0, _utils.pad)(i, 2) });
  }
  return options;
}

function readyForChange(state) {
  return (0, _keys2.default)(state).every(function (key) {
    return state[key] !== -1;
  });
}

function DateElement(props) {
  var type = props.type,
      range = props.range,
      value = props.value,
      select = props.select,
      rootId = props.rootId,
      disabled = props.disabled,
      readonly = props.readonly,
      autofocus = props.autofocus,
      registry = props.registry,
      onBlur = props.onBlur;

  var id = rootId + "_" + type;
  var SelectWidget = registry.widgets.SelectWidget;

  return _react2.default.createElement(SelectWidget, {
    schema: { type: "integer" },
    id: id,
    className: "form-control",
    options: { enumOptions: rangeOptions(range[0], range[1]) },
    placeholder: type,
    value: value,
    disabled: disabled,
    readonly: readonly,
    autofocus: autofocus,
    onChange: function onChange(value) {
      return select(type, value);
    },
    onBlur: onBlur
  });
}

var AltDateWidget = function (_Component) {
  (0, _inherits3.default)(AltDateWidget, _Component);

  function AltDateWidget(props) {
    (0, _classCallCheck3.default)(this, AltDateWidget);

    var _this = (0, _possibleConstructorReturn3.default)(this, (AltDateWidget.__proto__ || (0, _getPrototypeOf2.default)(AltDateWidget)).call(this, props));

    _this.onChange = function (property, value) {
      _this.setState((0, _defineProperty3.default)({}, property, typeof value === "undefined" ? -1 : value), function () {
        // Only propagate to parent state if we have a complete date{time}
        if (readyForChange(_this.state)) {
          _this.props.onChange((0, _utils.toDateString)(_this.state, _this.props.time));
        }
      });
    };

    _this.setNow = function (event) {
      event.preventDefault();
      var _this$props = _this.props,
          time = _this$props.time,
          disabled = _this$props.disabled,
          readonly = _this$props.readonly,
          onChange = _this$props.onChange;

      if (disabled || readonly) {
        return;
      }
      var nowDateObj = (0, _utils.parseDateString)(new Date().toJSON(), time);
      _this.setState(nowDateObj, function () {
        return onChange((0, _utils.toDateString)(_this.state, time));
      });
    };

    _this.clear = function (event) {
      event.preventDefault();
      var _this$props2 = _this.props,
          time = _this$props2.time,
          disabled = _this$props2.disabled,
          readonly = _this$props2.readonly,
          onChange = _this$props2.onChange;

      if (disabled || readonly) {
        return;
      }
      _this.setState((0, _utils.parseDateString)("", time), function () {
        return onChange(undefined);
      });
    };

    _this.state = (0, _utils.parseDateString)(props.value, props.time);
    return _this;
  }

  (0, _createClass3.default)(AltDateWidget, [{
    key: "componentWillReceiveProps",
    value: function componentWillReceiveProps(nextProps) {
      this.setState((0, _utils.parseDateString)(nextProps.value, nextProps.time));
    }
  }, {
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _utils.shouldRender)(this, nextProps, nextState);
    }
  }, {
    key: "render",
    value: function render() {
      var _this2 = this;

      var _props = this.props,
          id = _props.id,
          disabled = _props.disabled,
          readonly = _props.readonly,
          autofocus = _props.autofocus,
          registry = _props.registry,
          onBlur = _props.onBlur,
          options = _props.options;

      return _react2.default.createElement(
        "ul",
        { className: "list-inline" },
        this.dateElementProps.map(function (elemProps, i) {
          return _react2.default.createElement(
            "li",
            { key: i },
            _react2.default.createElement(DateElement, (0, _extends3.default)({
              rootId: id,
              select: _this2.onChange
            }, elemProps, {
              disabled: disabled,
              readonly: readonly,
              registry: registry,
              onBlur: onBlur,
              autofocus: autofocus && i === 0
            }))
          );
        }),
        (options.hideNowButton !== "undefined" ? !options.hideNowButton : true) && _react2.default.createElement(
          "li",
          null,
          _react2.default.createElement(
            "a",
            { href: "#", className: "btn btn-info btn-now", onClick: this.setNow },
            "Now"
          )
        ),
        (options.hideClearButton !== "undefined" ? !options.hideClearButton : true) && _react2.default.createElement(
          "li",
          null,
          _react2.default.createElement(
            "a",
            {
              href: "#",
              className: "btn btn-warning btn-clear",
              onClick: this.clear },
            "Clear"
          )
        )
      );
    }
  }, {
    key: "dateElementProps",
    get: function get() {
      var _props2 = this.props,
          time = _props2.time,
          options = _props2.options;
      var _state = this.state,
          year = _state.year,
          month = _state.month,
          day = _state.day,
          hour = _state.hour,
          minute = _state.minute,
          second = _state.second;

      var data = [{
        type: "year",
        range: options.yearsRange,
        value: year
      }, { type: "month", range: [1, 12], value: month }, { type: "day", range: [1, 31], value: day }];
      if (time) {
        data.push({ type: "hour", range: [0, 23], value: hour }, { type: "minute", range: [0, 59], value: minute }, { type: "second", range: [0, 59], value: second });
      }
      return data;
    }
  }]);
  return AltDateWidget;
}(_react.Component);

AltDateWidget.defaultProps = {
  time: false,
  disabled: false,
  readonly: false,
  autofocus: false,
  options: {
    yearsRange: [1900, new Date().getFullYear() + 2]
  }
};


if (process.env.NODE_ENV !== "production") {
  AltDateWidget.propTypes = {
    schema: _propTypes2.default.object.isRequired,
    id: _propTypes2.default.string.isRequired,
    value: _propTypes2.default.string,
    required: _propTypes2.default.bool,
    disabled: _propTypes2.default.bool,
    readonly: _propTypes2.default.bool,
    autofocus: _propTypes2.default.bool,
    onChange: _propTypes2.default.func,
    onBlur: _propTypes2.default.func,
    time: _propTypes2.default.bool,
    options: _propTypes2.default.object
  };
}

exports.default = AltDateWidget;