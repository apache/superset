import React from 'react';
import PropTypes from 'prop-types';
import Legend from './Legend';

export default function LegendSize({
  scale,
  domain,
  steps = 5,
  labelFormat = x => x,
  labelTransform = defaultTransform,
  ...restProps
}) {
  domain = domain || defaultDomain({ steps, scale });
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

function defaultDomain({ steps, scale }) {
  const domain = scale.domain();
  const start = domain[0];
  const end = domain[domain.length - 1];
  const step = (end - start) / (steps - 1);
  return new Array(steps).fill(1).reduce((acc, cur, i) => {
    acc.push(start + i * step);
    return acc;
  }, []);
}

function defaultTransform({ scale, labelFormat }) {
  return (d, i) => {
    return {
      text: `${labelFormat(d, i)}`,
      value: scale(d),
      datum: d,
      index: i,
    };
  };
}
