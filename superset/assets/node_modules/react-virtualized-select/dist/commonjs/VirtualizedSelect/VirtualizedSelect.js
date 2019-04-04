'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactSelect = require('react-select');

var _reactSelect2 = _interopRequireDefault(_reactSelect);

var _AutoSizer = require('react-virtualized/dist/commonjs/AutoSizer');

var _AutoSizer2 = _interopRequireDefault(_AutoSizer);

var _List = require('react-virtualized/dist/commonjs/List');

var _List2 = _interopRequireDefault(_List);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Import directly to avoid Webpack bundling the parts of react-virtualized that we are not using


var VirtualizedSelect = function (_Component) {
  _inherits(VirtualizedSelect, _Component);

  function VirtualizedSelect(props, context) {
    _classCallCheck(this, VirtualizedSelect);

    var _this = _possibleConstructorReturn(this, (VirtualizedSelect.__proto__ || Object.getPrototypeOf(VirtualizedSelect)).call(this, props, context));

    _this._renderMenu = _this._renderMenu.bind(_this);
    _this._optionRenderer = _this._optionRenderer.bind(_this);
    _this._setListRef = _this._setListRef.bind(_this);
    _this._setSelectRef = _this._setSelectRef.bind(_this);
    return _this;
  }

  /** See List#recomputeRowHeights */


  _createClass(VirtualizedSelect, [{
    key: 'recomputeOptionHeights',
    value: function recomputeOptionHeights() {
      var index = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      if (this._listRef) {
        this._listRef.recomputeRowHeights(index);
      }
    }

    /** See Select#focus (in react-select) */

  }, {
    key: 'focus',
    value: function focus() {
      if (this._selectRef) {
        return this._selectRef.focus();
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var SelectComponent = this._getSelectComponent();

      return _react2.default.createElement(SelectComponent, _extends({}, this.props, {
        ref: this._setSelectRef,
        menuRenderer: this._renderMenu,
        menuStyle: { overflow: 'hidden' }
      }));
    }

    // See https://github.com/JedWatson/react-select/#effeciently-rendering-large-lists-with-windowing

  }, {
    key: '_renderMenu',
    value: function _renderMenu(_ref) {
      var _this2 = this;

      var focusedOption = _ref.focusedOption,
          focusOption = _ref.focusOption,
          labelKey = _ref.labelKey,
          onSelect = _ref.onSelect,
          options = _ref.options,
          selectValue = _ref.selectValue,
          valueArray = _ref.valueArray,
          valueKey = _ref.valueKey;
      var _props = this.props,
          listProps = _props.listProps,
          optionRenderer = _props.optionRenderer;

      var focusedOptionIndex = options.indexOf(focusedOption);
      var height = this._calculateListHeight({ options: options });
      var innerRowRenderer = optionRenderer || this._optionRenderer;

      // react-select 1.0.0-rc2 passes duplicate `onSelect` and `selectValue` props to `menuRenderer`
      // The `Creatable` HOC only overrides `onSelect` which breaks an edge-case
      // In order to support creating items via clicking on the placeholder option,
      // We need to ensure that the specified `onSelect` handle is the one we use.
      // See issue #33

      function wrappedRowRenderer(_ref2) {
        var index = _ref2.index,
            key = _ref2.key,
            style = _ref2.style;

        var option = options[index];

        return innerRowRenderer({
          focusedOption: focusedOption,
          focusedOptionIndex: focusedOptionIndex,
          focusOption: focusOption,
          key: key,
          labelKey: labelKey,
          onSelect: onSelect,
          option: option,
          optionIndex: index,
          options: options,
          selectValue: onSelect,
          style: style,
          valueArray: valueArray,
          valueKey: valueKey
        });
      }

      return _react2.default.createElement(
        _AutoSizer2.default,
        { disableHeight: true },
        function (_ref3) {
          var width = _ref3.width;
          return _react2.default.createElement(_List2.default, _extends({
            className: 'VirtualSelectGrid',
            height: height,
            ref: _this2._setListRef,
            rowCount: options.length,
            rowHeight: function rowHeight(_ref4) {
              var index = _ref4.index;
              return _this2._getOptionHeight({
                option: options[index]
              });
            },
            rowRenderer: wrappedRowRenderer,
            scrollToIndex: focusedOptionIndex,
            width: width
          }, listProps));
        }
      );
    }
  }, {
    key: '_calculateListHeight',
    value: function _calculateListHeight(_ref5) {
      var options = _ref5.options;
      var maxHeight = this.props.maxHeight;


      var height = 0;

      for (var optionIndex = 0; optionIndex < options.length; optionIndex++) {
        var option = options[optionIndex];

        height += this._getOptionHeight({ option: option });

        if (height > maxHeight) {
          return maxHeight;
        }
      }

      return height;
    }
  }, {
    key: '_getOptionHeight',
    value: function _getOptionHeight(_ref6) {
      var option = _ref6.option;
      var optionHeight = this.props.optionHeight;


      return optionHeight instanceof Function ? optionHeight({ option: option }) : optionHeight;
    }
  }, {
    key: '_getSelectComponent',
    value: function _getSelectComponent() {
      var _props2 = this.props,
          async = _props2.async,
          selectComponent = _props2.selectComponent;


      if (selectComponent) {
        return selectComponent;
      } else if (async) {
        return _reactSelect2.default.Async;
      } else {
        return _reactSelect2.default;
      }
    }
  }, {
    key: '_optionRenderer',
    value: function _optionRenderer(_ref7) {
      var focusedOption = _ref7.focusedOption,
          focusOption = _ref7.focusOption,
          key = _ref7.key,
          labelKey = _ref7.labelKey,
          option = _ref7.option,
          selectValue = _ref7.selectValue,
          style = _ref7.style,
          valueArray = _ref7.valueArray;

      var className = ['VirtualizedSelectOption'];

      if (option === focusedOption) {
        className.push('VirtualizedSelectFocusedOption');
      }

      if (option.disabled) {
        className.push('VirtualizedSelectDisabledOption');
      }

      if (valueArray && valueArray.indexOf(option) >= 0) {
        className.push('VirtualizedSelectSelectedOption');
      }

      if (option.className) {
        className.push(option.className);
      }

      var events = option.disabled ? {} : {
        onClick: function onClick() {
          return selectValue(option);
        },
        onMouseEnter: function onMouseEnter() {
          return focusOption(option);
        }
      };

      return _react2.default.createElement(
        'div',
        _extends({
          className: className.join(' '),
          key: key,
          style: style,
          title: option.title
        }, events),
        option[labelKey]
      );
    }
  }, {
    key: '_setListRef',
    value: function _setListRef(ref) {
      this._listRef = ref;
    }
  }, {
    key: '_setSelectRef',
    value: function _setSelectRef(ref) {
      this._selectRef = ref;
    }
  }]);

  return VirtualizedSelect;
}(_react.Component);

VirtualizedSelect.propTypes = {
  async: _propTypes2.default.bool,
  listProps: _propTypes2.default.object,
  maxHeight: _propTypes2.default.number,
  optionHeight: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.func]),
  optionRenderer: _propTypes2.default.func,
  selectComponent: _propTypes2.default.func
};
VirtualizedSelect.defaultProps = {
  async: false,
  maxHeight: 200,
  optionHeight: 35
};
exports.default = VirtualizedSelect;