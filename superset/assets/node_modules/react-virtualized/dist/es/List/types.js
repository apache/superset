import * as React from 'react';

var bpfrpt_proptype_RowRendererParams = process.env.NODE_ENV === 'production' ? null : {
  index: PropTypes.number.isRequired,
  isScrolling: PropTypes.bool.isRequired,
  isVisible: PropTypes.bool.isRequired,
  key: PropTypes.string.isRequired,
  parent: PropTypes.object.isRequired,
  style: PropTypes.object.isRequired
};
var bpfrpt_proptype_RowRenderer = process.env.NODE_ENV === 'production' ? null : PropTypes.func;
var bpfrpt_proptype_RenderedRows = process.env.NODE_ENV === 'production' ? null : {
  overscanStartIndex: PropTypes.number.isRequired,
  overscanStopIndex: PropTypes.number.isRequired,
  startIndex: PropTypes.number.isRequired,
  stopIndex: PropTypes.number.isRequired
};
var bpfrpt_proptype_Scroll = process.env.NODE_ENV === 'production' ? null : {
  clientHeight: PropTypes.number.isRequired,
  scrollHeight: PropTypes.number.isRequired,
  scrollTop: PropTypes.number.isRequired
};
import PropTypes from 'prop-types';
export { bpfrpt_proptype_RowRendererParams };
export { bpfrpt_proptype_RowRenderer };
export { bpfrpt_proptype_RenderedRows };
export { bpfrpt_proptype_Scroll };