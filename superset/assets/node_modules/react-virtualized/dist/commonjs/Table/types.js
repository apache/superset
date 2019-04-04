"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bpfrpt_proptype_RowRendererParams = exports.bpfrpt_proptype_HeaderRendererParams = exports.bpfrpt_proptype_HeaderRowRendererParams = exports.bpfrpt_proptype_CellRendererParams = exports.bpfrpt_proptype_CellDataGetterParams = undefined;

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var bpfrpt_proptype_CellDataGetterParams = process.env.NODE_ENV === 'production' ? null : {
  columnData: _propTypes2.default.any,
  dataKey: _propTypes2.default.string.isRequired,
  rowData: function rowData(props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  }
};
var bpfrpt_proptype_CellRendererParams = process.env.NODE_ENV === 'production' ? null : {
  cellData: _propTypes2.default.any,
  columnData: _propTypes2.default.any,
  dataKey: _propTypes2.default.string.isRequired,
  rowData: function rowData(props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  },
  rowIndex: _propTypes2.default.number.isRequired
};
var bpfrpt_proptype_HeaderRowRendererParams = process.env.NODE_ENV === 'production' ? null : {
  className: _propTypes2.default.string.isRequired,
  columns: _propTypes2.default.arrayOf(function (props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  }).isRequired,
  style: function style(props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  }
};
var bpfrpt_proptype_HeaderRendererParams = process.env.NODE_ENV === 'production' ? null : {
  columnData: _propTypes2.default.any,
  dataKey: _propTypes2.default.string.isRequired,
  disableSort: _propTypes2.default.bool,
  label: _propTypes2.default.any,
  sortBy: _propTypes2.default.string,
  sortDirection: _propTypes2.default.string
};
var bpfrpt_proptype_RowRendererParams = process.env.NODE_ENV === 'production' ? null : {
  className: _propTypes2.default.string.isRequired,
  columns: _propTypes2.default.arrayOf(function (props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  }).isRequired,
  index: _propTypes2.default.number.isRequired,
  isScrolling: _propTypes2.default.bool.isRequired,
  onRowClick: _propTypes2.default.func,
  onRowDoubleClick: _propTypes2.default.func,
  onRowMouseOver: _propTypes2.default.func,
  onRowMouseOut: _propTypes2.default.func,
  rowData: function rowData(props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  },
  style: function style(props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  }
};
exports.bpfrpt_proptype_CellDataGetterParams = bpfrpt_proptype_CellDataGetterParams;
exports.bpfrpt_proptype_CellRendererParams = bpfrpt_proptype_CellRendererParams;
exports.bpfrpt_proptype_HeaderRowRendererParams = bpfrpt_proptype_HeaderRowRendererParams;
exports.bpfrpt_proptype_HeaderRendererParams = bpfrpt_proptype_HeaderRendererParams;
exports.bpfrpt_proptype_RowRendererParams = bpfrpt_proptype_RowRendererParams;