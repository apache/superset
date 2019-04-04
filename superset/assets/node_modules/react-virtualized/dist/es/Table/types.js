var bpfrpt_proptype_CellDataGetterParams = process.env.NODE_ENV === 'production' ? null : {
  columnData: PropTypes.any,
  dataKey: PropTypes.string.isRequired,
  rowData: function rowData(props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  }
};
var bpfrpt_proptype_CellRendererParams = process.env.NODE_ENV === 'production' ? null : {
  cellData: PropTypes.any,
  columnData: PropTypes.any,
  dataKey: PropTypes.string.isRequired,
  rowData: function rowData(props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  },
  rowIndex: PropTypes.number.isRequired
};
var bpfrpt_proptype_HeaderRowRendererParams = process.env.NODE_ENV === 'production' ? null : {
  className: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(function (props, propName, componentName) {
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
  columnData: PropTypes.any,
  dataKey: PropTypes.string.isRequired,
  disableSort: PropTypes.bool,
  label: PropTypes.any,
  sortBy: PropTypes.string,
  sortDirection: PropTypes.string
};
var bpfrpt_proptype_RowRendererParams = process.env.NODE_ENV === 'production' ? null : {
  className: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(function (props, propName, componentName) {
    if (!Object.prototype.hasOwnProperty.call(props, propName)) {
      throw new Error("Prop `" + propName + "` has type 'any' or 'mixed', but was not provided to `" + componentName + "`. Pass undefined or any other value.");
    }
  }).isRequired,
  index: PropTypes.number.isRequired,
  isScrolling: PropTypes.bool.isRequired,
  onRowClick: PropTypes.func,
  onRowDoubleClick: PropTypes.func,
  onRowMouseOver: PropTypes.func,
  onRowMouseOut: PropTypes.func,
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
import PropTypes from "prop-types";
export { bpfrpt_proptype_CellDataGetterParams };
export { bpfrpt_proptype_CellRendererParams };
export { bpfrpt_proptype_HeaderRowRendererParams };
export { bpfrpt_proptype_HeaderRendererParams };
export { bpfrpt_proptype_RowRendererParams };