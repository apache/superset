'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _td = require('./td');

var _libTo_array = require('./lib/to_array');

var _libFilter_props_from = require('./lib/filter_props_from');

var Tr = (function (_React$Component) {
    _inherits(Tr, _React$Component);

    function Tr() {
        _classCallCheck(this, Tr);

        _get(Object.getPrototypeOf(Tr.prototype), 'constructor', this).apply(this, arguments);
    }

    _createClass(Tr, [{
        key: 'render',
        value: function render() {
            var children = (0, _libTo_array.toArray)(_react2['default'].Children.children(this.props.children));

            if (this.props.data && this.props.columns && typeof this.props.columns.map === 'function') {
                if (typeof children.concat === 'undefined') {
                    console.log(children);
                }

                children = children.concat(this.props.columns.map((function (_ref, i) {
                    var _ref$props = _ref.props;
                    var props = _ref$props === undefined ? {} : _ref$props;

                    var column = _objectWithoutProperties(_ref, ['props']);

                    if (this.props.data.hasOwnProperty(column.key)) {
                        var value = this.props.data[column.key];

                        if (typeof value !== 'undefined' && value !== null && value.__reactableMeta === true) {
                            props = value.props;
                            value = value.value;
                        }

                        return _react2['default'].createElement(
                            _td.Td,
                            _extends({ column: column, key: column.key }, props),
                            value
                        );
                    } else {
                        return _react2['default'].createElement(_td.Td, { column: column, key: column.key });
                    }
                }).bind(this)));
            }

            // Manually transfer props
            var props = (0, _libFilter_props_from.filterPropsFrom)(this.props);

            return _react2['default'].createElement('tr', props, children);
        }
    }]);

    return Tr;
})(_react2['default'].Component);

exports.Tr = Tr;
;

Tr.childNode = _td.Td;
Tr.dataType = 'object';
