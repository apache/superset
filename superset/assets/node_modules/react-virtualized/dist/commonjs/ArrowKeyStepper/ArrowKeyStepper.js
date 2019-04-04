'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _reactLifecyclesCompat = require('react-lifecycles-compat');

var _Grid = require('../Grid');

var _types = require('./types');

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * This HOC decorates a virtualized component and responds to arrow-key events by scrolling one row or column at a time.
 */

var ArrowKeyStepper = function (_React$PureComponent) {
  (0, _inherits3.default)(ArrowKeyStepper, _React$PureComponent);

  function ArrowKeyStepper() {
    var _ref;

    var _temp, _this, _ret;

    (0, _classCallCheck3.default)(this, ArrowKeyStepper);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = (0, _possibleConstructorReturn3.default)(this, (_ref = ArrowKeyStepper.__proto__ || (0, _getPrototypeOf2.default)(ArrowKeyStepper)).call.apply(_ref, [this].concat(args))), _this), _this.state = {
      scrollToColumn: 0,
      scrollToRow: 0
    }, _this._columnStartIndex = 0, _this._columnStopIndex = 0, _this._rowStartIndex = 0, _this._rowStopIndex = 0, _this._onKeyDown = function (event) {
      var _this$props = _this.props,
          columnCount = _this$props.columnCount,
          disabled = _this$props.disabled,
          mode = _this$props.mode,
          rowCount = _this$props.rowCount;


      if (disabled) {
        return;
      }

      var _this$_getScrollState = _this._getScrollState(),
          scrollToColumnPrevious = _this$_getScrollState.scrollToColumn,
          scrollToRowPrevious = _this$_getScrollState.scrollToRow;

      var _this$_getScrollState2 = _this._getScrollState(),
          scrollToColumn = _this$_getScrollState2.scrollToColumn,
          scrollToRow = _this$_getScrollState2.scrollToRow;

      // The above cases all prevent default event event behavior.
      // This is to keep the grid from scrolling after the snap-to update.


      switch (event.key) {
        case 'ArrowDown':
          scrollToRow = mode === 'cells' ? Math.min(scrollToRow + 1, rowCount - 1) : Math.min(_this._rowStopIndex + 1, rowCount - 1);
          break;
        case 'ArrowLeft':
          scrollToColumn = mode === 'cells' ? Math.max(scrollToColumn - 1, 0) : Math.max(_this._columnStartIndex - 1, 0);
          break;
        case 'ArrowRight':
          scrollToColumn = mode === 'cells' ? Math.min(scrollToColumn + 1, columnCount - 1) : Math.min(_this._columnStopIndex + 1, columnCount - 1);
          break;
        case 'ArrowUp':
          scrollToRow = mode === 'cells' ? Math.max(scrollToRow - 1, 0) : Math.max(_this._rowStartIndex - 1, 0);
          break;
      }

      if (scrollToColumn !== scrollToColumnPrevious || scrollToRow !== scrollToRowPrevious) {
        event.preventDefault();

        _this._updateScrollState({ scrollToColumn: scrollToColumn, scrollToRow: scrollToRow });
      }
    }, _this._onSectionRendered = function (_ref2) {
      var columnStartIndex = _ref2.columnStartIndex,
          columnStopIndex = _ref2.columnStopIndex,
          rowStartIndex = _ref2.rowStartIndex,
          rowStopIndex = _ref2.rowStopIndex;

      _this._columnStartIndex = columnStartIndex;
      _this._columnStopIndex = columnStopIndex;
      _this._rowStartIndex = rowStartIndex;
      _this._rowStopIndex = rowStopIndex;
    }, _temp), (0, _possibleConstructorReturn3.default)(_this, _ret);
  }

  (0, _createClass3.default)(ArrowKeyStepper, [{
    key: 'setScrollIndexes',
    value: function setScrollIndexes(_ref3) {
      var scrollToColumn = _ref3.scrollToColumn,
          scrollToRow = _ref3.scrollToRow;

      this.setState({
        scrollToRow: scrollToRow,
        scrollToColumn: scrollToColumn
      });
    }
  }, {
    key: 'render',
    value: function render() {
      var _props = this.props,
          className = _props.className,
          children = _props.children;

      var _getScrollState2 = this._getScrollState(),
          scrollToColumn = _getScrollState2.scrollToColumn,
          scrollToRow = _getScrollState2.scrollToRow;

      return React.createElement(
        'div',
        { className: className, onKeyDown: this._onKeyDown },
        children({
          onSectionRendered: this._onSectionRendered,
          scrollToColumn: scrollToColumn,
          scrollToRow: scrollToRow
        })
      );
    }
  }, {
    key: '_getScrollState',
    value: function _getScrollState() {
      return this.props.isControlled ? this.props : this.state;
    }
  }, {
    key: '_updateScrollState',
    value: function _updateScrollState(_ref4) {
      var scrollToColumn = _ref4.scrollToColumn,
          scrollToRow = _ref4.scrollToRow;
      var _props2 = this.props,
          isControlled = _props2.isControlled,
          onScrollToChange = _props2.onScrollToChange;


      if (typeof onScrollToChange === 'function') {
        onScrollToChange({ scrollToColumn: scrollToColumn, scrollToRow: scrollToRow });
      }

      if (!isControlled) {
        this.setState({ scrollToColumn: scrollToColumn, scrollToRow: scrollToRow });
      }
    }
  }], [{
    key: 'getDerivedStateFromProps',
    value: function getDerivedStateFromProps(nextProps, prevState) {
      if (nextProps.isControlled) {
        return null;
      }

      if (nextProps.scrollToColumn !== prevState.scrollToColumn || nextProps.scrollToRow !== prevState.scrollToRow) {
        return {
          scrollToColumn: nextProps.scrollToColumn,
          scrollToRow: nextProps.scrollToRow
        };
      }

      return null;
    }
  }]);
  return ArrowKeyStepper;
}(React.PureComponent);

ArrowKeyStepper.defaultProps = {
  disabled: false,
  isControlled: false,
  mode: 'edges',
  scrollToColumn: 0,
  scrollToRow: 0
};
ArrowKeyStepper.propTypes = process.env.NODE_ENV === 'production' ? null : {
  children: _propTypes2.default.func.isRequired,
  className: _propTypes2.default.string,
  columnCount: _propTypes2.default.number.isRequired,
  disabled: _propTypes2.default.bool.isRequired,
  isControlled: _propTypes2.default.bool.isRequired,
  mode: _propTypes2.default.oneOf(['cells', 'edges']).isRequired,
  onScrollToChange: _propTypes2.default.func,
  rowCount: _propTypes2.default.number.isRequired,
  scrollToColumn: _propTypes2.default.number.isRequired,
  scrollToRow: _propTypes2.default.number.isRequired
};


(0, _reactLifecyclesCompat.polyfill)(ArrowKeyStepper);

exports.default = ArrowKeyStepper;