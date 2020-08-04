'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _th = require('./th');

var _filterer = require('./filterer');

var _libFilter_props_from = require('./lib/filter_props_from');

var Thead = (function (_React$Component) {
    _inherits(Thead, _React$Component);

    function Thead() {
        _classCallCheck(this, Thead);

        _get(Object.getPrototypeOf(Thead.prototype), 'constructor', this).apply(this, arguments);
    }

    _createClass(Thead, [{
        key: 'handleClickTh',
        value: function handleClickTh(column) {
            this.props.onSort(column.key);
        }
    }, {
        key: 'handleKeyDownTh',
        value: function handleKeyDownTh(column, event) {
            if (event.keyCode === 13) {
                this.props.onSort(column.key);
            }
        }
    }, {
        key: 'render',
        value: function render() {
            // Declare the list of Ths
            var Ths = [];
            for (var index = 0; index < this.props.columns.length; index++) {
                var column = this.props.columns[index];
                var thClass = 'reactable-th-' + column.key.replace(/\s+/g, '-').toLowerCase();
                var sortClass = '';
                var thRole = null;

                if (this.props.sortableColumns[column.key]) {
                    sortClass += 'reactable-header-sortable ';
                    thRole = 'button';
                }

                if (this.props.sort.column === column.key) {
                    sortClass += 'reactable-header-sort';
                    if (this.props.sort.direction === 1) {
                        sortClass += '-asc';
                    } else {
                        sortClass += '-desc';
                    }
                }

                if (sortClass.length > 0) {
                    thClass += ' ' + sortClass;
                }

                if (typeof column.props === 'object' && typeof column.props.className === 'string') {
                    thClass += ' ' + column.props.className;
                }

                Ths.push(_react2['default'].createElement(
                    _th.Th,
                    _extends({}, column.props, {
                        className: thClass,
                        key: index,
                        onClick: this.handleClickTh.bind(this, column),
                        onKeyDown: this.handleKeyDownTh.bind(this, column),
                        role: thRole,
                        tabIndex: '0' }),
                    column.label
                ));
            }

            // Manually transfer props
            var props = (0, _libFilter_props_from.filterPropsFrom)(this.props);

            return _react2['default'].createElement(
                'thead',
                props,
                this.props.filtering === true ? _react2['default'].createElement(_filterer.Filterer, {
                    colSpan: this.props.columns.length,
                    onFilter: this.props.onFilter,
                    placeholder: this.props.filterPlaceholder,
                    value: this.props.currentFilter,
                    className: this.props.filterClassName
                }) : null,
                _react2['default'].createElement(
                    'tr',
                    { className: 'reactable-column-header' },
                    Ths
                )
            );
        }
    }], [{
        key: 'getColumns',
        value: function getColumns(component) {
            // Can't use React.Children.map since that doesn't return a proper array
            var columns = [];
            _react2['default'].Children.forEach(component.props.children, function (th) {
                var column = {};
                if (!th) return;
                if (typeof th.props !== 'undefined') {
                    column.props = (0, _libFilter_props_from.filterPropsFrom)(th.props);

                    // use the content as the label & key
                    if (typeof th.props.children !== 'undefined') {
                        column.label = th.props.children;
                        column.key = column.label;
                    }

                    // the key in the column attribute supersedes the one defined previously
                    if (typeof th.props.column === 'string') {
                        column.key = th.props.column;

                        // in case we don't have a label yet
                        if (typeof column.label === 'undefined') {
                            column.label = column.key;
                        }
                    }
                }

                if (typeof column.key === 'undefined') {
                    throw new TypeError('<th> must have either a "column" property or a string ' + 'child');
                } else {
                    columns.push(column);
                }
            });

            return columns;
        }
    }]);

    return Thead;
})(_react2['default'].Component);

exports.Thead = Thead;
;
