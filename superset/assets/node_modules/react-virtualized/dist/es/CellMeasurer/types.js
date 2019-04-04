var bpfrpt_proptype_CellMeasureCache = process.env.NODE_ENV === 'production' ? null : {
  hasFixedWidth: PropTypes.func.isRequired,
  hasFixedHeight: PropTypes.func.isRequired,
  has: PropTypes.func.isRequired,
  set: PropTypes.func.isRequired,
  getHeight: PropTypes.func.isRequired,
  getWidth: PropTypes.func.isRequired
};
import PropTypes from "prop-types";
export { bpfrpt_proptype_CellMeasureCache };