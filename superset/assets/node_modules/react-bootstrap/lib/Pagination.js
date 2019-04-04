'use strict';

exports.__esModule = true;

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _elementType = require('prop-types-extra/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _PaginationButton = require('./PaginationButton');

var _PaginationButton2 = _interopRequireDefault(_PaginationButton);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  activePage: _propTypes2.default.number,
  items: _propTypes2.default.number,
  maxButtons: _propTypes2.default.number,

  /**
   * When `true`, will display the first and the last button page when
   * displaying ellipsis.
   */
  boundaryLinks: _propTypes2.default.bool,

  /**
   * When `true`, will display the default node value ('&hellip;').
   * Otherwise, will display provided node (when specified).
   */
  ellipsis: _propTypes2.default.oneOfType([_propTypes2.default.bool, _propTypes2.default.node]),

  /**
   * When `true`, will display the default node value ('&laquo;').
   * Otherwise, will display provided node (when specified).
   */
  first: _propTypes2.default.oneOfType([_propTypes2.default.bool, _propTypes2.default.node]),

  /**
   * When `true`, will display the default node value ('&raquo;').
   * Otherwise, will display provided node (when specified).
   */
  last: _propTypes2.default.oneOfType([_propTypes2.default.bool, _propTypes2.default.node]),

  /**
   * When `true`, will display the default node value ('&lsaquo;').
   * Otherwise, will display provided node (when specified).
   */
  prev: _propTypes2.default.oneOfType([_propTypes2.default.bool, _propTypes2.default.node]),

  /**
   * When `true`, will display the default node value ('&rsaquo;').
   * Otherwise, will display provided node (when specified).
   */
  next: _propTypes2.default.oneOfType([_propTypes2.default.bool, _propTypes2.default.node]),

  onSelect: _propTypes2.default.func,

  /**
   * You can use a custom element for the buttons
   */
  buttonComponentClass: _elementType2.default
};

var defaultProps = {
  activePage: 1,
  items: 1,
  maxButtons: 0,
  first: false,
  last: false,
  prev: false,
  next: false,
  ellipsis: true,
  boundaryLinks: false
};

var Pagination = function (_React$Component) {
  (0, _inherits3.default)(Pagination, _React$Component);

  function Pagination() {
    (0, _classCallCheck3.default)(this, Pagination);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Pagination.prototype.renderPageButtons = function renderPageButtons(activePage, items, maxButtons, boundaryLinks, ellipsis, buttonProps) {
    var pageButtons = [];

    var startPage = void 0;
    var endPage = void 0;

    if (maxButtons && maxButtons < items) {
      startPage = Math.max(Math.min(activePage - Math.floor(maxButtons / 2, 10), items - maxButtons + 1), 1);
      endPage = startPage + maxButtons - 1;
    } else {
      startPage = 1;
      endPage = items;
    }

    for (var page = startPage; page <= endPage; ++page) {
      pageButtons.push(_react2.default.createElement(
        _PaginationButton2.default,
        (0, _extends3.default)({}, buttonProps, {
          key: page,
          eventKey: page,
          active: page === activePage
        }),
        page
      ));
    }

    if (ellipsis && boundaryLinks && startPage > 1) {
      if (startPage > 2) {
        pageButtons.unshift(_react2.default.createElement(
          _PaginationButton2.default,
          {
            key: 'ellipsisFirst',
            disabled: true,
            componentClass: buttonProps.componentClass
          },
          _react2.default.createElement(
            'span',
            { 'aria-label': 'More' },
            ellipsis === true ? '\u2026' : ellipsis
          )
        ));
      }

      pageButtons.unshift(_react2.default.createElement(
        _PaginationButton2.default,
        (0, _extends3.default)({}, buttonProps, {
          key: 1,
          eventKey: 1,
          active: false
        }),
        '1'
      ));
    }

    if (ellipsis && endPage < items) {
      if (!boundaryLinks || endPage < items - 1) {
        pageButtons.push(_react2.default.createElement(
          _PaginationButton2.default,
          {
            key: 'ellipsis',
            disabled: true,
            componentClass: buttonProps.componentClass
          },
          _react2.default.createElement(
            'span',
            { 'aria-label': 'More' },
            ellipsis === true ? '\u2026' : ellipsis
          )
        ));
      }

      if (boundaryLinks) {
        pageButtons.push(_react2.default.createElement(
          _PaginationButton2.default,
          (0, _extends3.default)({}, buttonProps, {
            key: items,
            eventKey: items,
            active: false
          }),
          items
        ));
      }
    }

    return pageButtons;
  };

  Pagination.prototype.render = function render() {
    var _props = this.props,
        activePage = _props.activePage,
        items = _props.items,
        maxButtons = _props.maxButtons,
        boundaryLinks = _props.boundaryLinks,
        ellipsis = _props.ellipsis,
        first = _props.first,
        last = _props.last,
        prev = _props.prev,
        next = _props.next,
        onSelect = _props.onSelect,
        buttonComponentClass = _props.buttonComponentClass,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['activePage', 'items', 'maxButtons', 'boundaryLinks', 'ellipsis', 'first', 'last', 'prev', 'next', 'onSelect', 'buttonComponentClass', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    var buttonProps = {
      onSelect: onSelect,
      componentClass: buttonComponentClass
    };

    return _react2.default.createElement(
      'ul',
      (0, _extends3.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, classes)
      }),
      first && _react2.default.createElement(
        _PaginationButton2.default,
        (0, _extends3.default)({}, buttonProps, {
          eventKey: 1,
          disabled: activePage === 1
        }),
        _react2.default.createElement(
          'span',
          { 'aria-label': 'First' },
          first === true ? '\xAB' : first
        )
      ),
      prev && _react2.default.createElement(
        _PaginationButton2.default,
        (0, _extends3.default)({}, buttonProps, {
          eventKey: activePage - 1,
          disabled: activePage === 1
        }),
        _react2.default.createElement(
          'span',
          { 'aria-label': 'Previous' },
          prev === true ? '\u2039' : prev
        )
      ),
      this.renderPageButtons(activePage, items, maxButtons, boundaryLinks, ellipsis, buttonProps),
      next && _react2.default.createElement(
        _PaginationButton2.default,
        (0, _extends3.default)({}, buttonProps, {
          eventKey: activePage + 1,
          disabled: activePage >= items
        }),
        _react2.default.createElement(
          'span',
          { 'aria-label': 'Next' },
          next === true ? '\u203A' : next
        )
      ),
      last && _react2.default.createElement(
        _PaginationButton2.default,
        (0, _extends3.default)({}, buttonProps, {
          eventKey: items,
          disabled: activePage >= items
        }),
        _react2.default.createElement(
          'span',
          { 'aria-label': 'Last' },
          last === true ? '\xBB' : last
        )
      )
    );
  };

  return Pagination;
}(_react2.default.Component);

Pagination.propTypes = propTypes;
Pagination.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('pagination', Pagination);
module.exports = exports['default'];