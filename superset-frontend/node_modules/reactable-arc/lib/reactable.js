'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactableTable = require('./reactable/table');

var _reactableTr = require('./reactable/tr');

var _reactableTd = require('./reactable/td');

var _reactableTh = require('./reactable/th');

var _reactableTfoot = require('./reactable/tfoot');

var _reactableThead = require('./reactable/thead');

var _reactableSort = require('./reactable/sort');

var _reactableUnsafe = require('./reactable/unsafe');

_react2['default'].Children.children = function (children) {
    return _react2['default'].Children.map(children, function (x) {
        return x;
    }) || [];
};

var Reactable = { Table: _reactableTable.Table, Tr: _reactableTr.Tr, Td: _reactableTd.Td, Th: _reactableTh.Th, Tfoot: _reactableTfoot.Tfoot, Thead: _reactableThead.Thead, Sort: _reactableSort.Sort, unsafe: _reactableUnsafe.unsafe };

exports['default'] = Reactable;

if (typeof window !== 'undefined') {
    window.Reactable = Reactable;
}
module.exports = exports['default'];
