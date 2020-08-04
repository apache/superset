import React from 'react';
import PropTypes from 'prop-types';
import Legend from './Legend';
import valueOrIdentity from '../util/valueOrIdentity';

LegendOrdinal.propTypes = {
  scale: PropTypes.func.isRequired,
  domain: PropTypes.array,
  labelTransform: PropTypes.func,
  labelFormat: PropTypes.func,
};

export default function LegendOrdinal({
  scale,
  domain,
  labelTransform = defaultTransform,
  labelFormat = valueOrIdentity,
  ...restProps
}) {
  return (
    <Legend
      scale={scale}
      domain={domain}
      labelFormat={labelFormat}
      labelTransform={labelTransform}
      {...restProps}
    />
  );
}

function defaultTransform({ scale, labelFormat }) {
  return (d, i) => {
    return {
      datum: d,
      index: i,
      text: `${labelFormat(d, i)}`,
      value: scale(d),
    };
  };
}
