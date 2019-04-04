var bpfrpt_proptype_Index = process.env.NODE_ENV === 'production' ? null : {
  index: PropTypes.number.isRequired
};
var bpfrpt_proptype_PositionInfo = process.env.NODE_ENV === 'production' ? null : {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired
};
var bpfrpt_proptype_ScrollPosition = process.env.NODE_ENV === 'production' ? null : {
  scrollLeft: PropTypes.number.isRequired,
  scrollTop: PropTypes.number.isRequired
};
var bpfrpt_proptype_SizeAndPositionInfo = process.env.NODE_ENV === 'production' ? null : {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired
};
var bpfrpt_proptype_SizeInfo = process.env.NODE_ENV === 'production' ? null : {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired
};
import PropTypes from "prop-types";
export { bpfrpt_proptype_Index };
export { bpfrpt_proptype_PositionInfo };
export { bpfrpt_proptype_ScrollPosition };
export { bpfrpt_proptype_SizeAndPositionInfo };
export { bpfrpt_proptype_SizeInfo };