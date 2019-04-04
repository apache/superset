(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "babel-runtime/helpers/extends", "babel-runtime/helpers/classCallCheck", "babel-runtime/helpers/createClass", "babel-runtime/helpers/possibleConstructorReturn", "babel-runtime/helpers/inherits", "react", "prop-types", "bootstrap-slider"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("babel-runtime/helpers/extends"), require("babel-runtime/helpers/classCallCheck"), require("babel-runtime/helpers/createClass"), require("babel-runtime/helpers/possibleConstructorReturn"), require("babel-runtime/helpers/inherits"), require("react"), require("prop-types"), require("bootstrap-slider"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global._extends, global.classCallCheck, global.createClass, global.possibleConstructorReturn, global.inherits, global.react, global.propTypes, global.bootstrapSlider);
    global.reactBootstrapSlider = mod.exports;
  }
})(this, function (exports, _extends2, _classCallCheck2, _createClass2, _possibleConstructorReturn2, _inherits2, _react, _propTypes, _bootstrapSlider) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ReactBootstrapSlider = undefined;

  var _extends3 = _interopRequireDefault(_extends2);

  var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

  var _createClass3 = _interopRequireDefault(_createClass2);

  var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

  var _inherits3 = _interopRequireDefault(_inherits2);

  var _react2 = _interopRequireDefault(_react);

  var _propTypes2 = _interopRequireDefault(_propTypes);

  var _bootstrapSlider2 = _interopRequireDefault(_bootstrapSlider);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  var ReactBootstrapSlider = exports.ReactBootstrapSlider = function (_React$Component) {
    (0, _inherits3.default)(ReactBootstrapSlider, _React$Component);

    function ReactBootstrapSlider() {
      var _ref;

      var _temp, _this, _ret;

      (0, _classCallCheck3.default)(this, ReactBootstrapSlider);

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return _ret = (_temp = (_this = (0, _possibleConstructorReturn3.default)(this, (_ref = ReactBootstrapSlider.__proto__ || Object.getPrototypeOf(ReactBootstrapSlider)).call.apply(_ref, [this].concat(args))), _this), _this.checkAndDoDisabled = function () {
        var sliderEnable = _this.props.disabled !== "disabled";
        var currentlyEnabled = _this.mySlider.isEnabled();
        if (sliderEnable) {
          if (!currentlyEnabled) {
            _this.mySlider.enable();
          }
        } else {
          if (currentlyEnabled) {
            _this.mySlider.disable();
          }
        }
      }, _this.updateSliderValues = function () {
        if (typeof _this.props.min !== "undefined" && (typeof _this.mySlider.min !== "undefined" || typeof _this.mySlider.options.min !== "undefined")) {
          _this.mySlider.setAttribute("min", _this.props.min);
        }
        if (typeof _this.props.max !== "undefined" && (typeof _this.mySlider.max !== "undefined" || typeof _this.mySlider.options.max !== "undefined")) {
          _this.mySlider.setAttribute("max", _this.props.max);
        }
        if (typeof _this.props.step !== "undefined" && (typeof _this.mySlider.step !== "undefined" || typeof _this.mySlider.options.step !== "undefined")) {
          _this.mySlider.setAttribute("step", _this.props.step);
        }

        _this.mySlider.setValue(_this.props.value);
        _this.checkAndDoDisabled();
      }, _temp), (0, _possibleConstructorReturn3.default)(_this, _ret);
    }
    // constructor(props) {
    //   super(props);
    //   // this.updateSliderValues = this.updateSliderValues.bind(this);
    //   // this.checkAndDoDisabled = this.checkAndDoDisabled.bind(this);
    // }

    (0, _createClass3.default)(ReactBootstrapSlider, [{
      key: "componentDidMount",
      value: function componentDidMount() {
        var that = this;
        var sliderAttributes = (0, _extends3.default)({}, this.props, {
          tooltip: this.props.tooltip || "show"
        });
        // console.log("sliderAttributes = " + JSON.stringify(sliderAttributes, null, 4));

        this.mySlider = new _bootstrapSlider2.default(this.node, sliderAttributes);

        //     this.updateSliderValues();
        if (this.props.change || this.props.handleChange) {
          var changeEvent = this.props.change || this.props.handleChange;
          this.mySlider.on("change", function (e) {
            var fakeEvent = {
              target: {}
            };
            fakeEvent.target.value = e.newValue;
            changeEvent(fakeEvent);
          });
        }

        if (this.props.slideStop) {
          this.mySlider.on("slideStop", function (e) {
            var fakeEvent = {
              target: {}
            };
            fakeEvent.target.value = e;
            that.props.slideStop(fakeEvent);
          });
        }
        this.checkAndDoDisabled();
      }
    }, {
      key: "componentDidUpdate",
      value: function componentDidUpdate() {
        this.updateSliderValues();
      }
    }, {
      key: "componentWillUnmount",
      value: function componentWillUnmount() {
        this.mySlider.destroy();
      }
    }, {
      key: "render",
      value: function render() {
        var _this2 = this;

        // The slider"s an input.  That"s all we need.  We"ll do the rest in
        // the componentDidMount() method.
        return _react2.default.createElement("div", { ref: function ref(node) {
            return _this2.node = node;
          } });
      }
    }]);
    return ReactBootstrapSlider;
  }(_react2.default.Component);

  ReactBootstrapSlider.propTypes = {
    min: _propTypes2.default.number,
    max: _propTypes2.default.number,
    step: _propTypes2.default.number,
    value: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.arrayOf(_propTypes2.default.number.isRequired).isRequired]).isRequired,
    disabled: _propTypes2.default.string,
    tooltip: _propTypes2.default.string,
    change: _propTypes2.default.func,
    handleChange: _propTypes2.default.func,
    slideStop: _propTypes2.default.func,
    labelledby: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.arrayOf(_propTypes2.default.string)])
  };

  exports.default = ReactBootstrapSlider;
});
