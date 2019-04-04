import React from 'react';
import PropTypes from 'prop-types';
import Legend from './Legend';

LegendThreshold.propTypes = {
  scale: PropTypes.func.isRequired,
  domain: PropTypes.array,
  labelTransform: PropTypes.func,
  labelFormat: PropTypes.func,
  labelDelimiter: PropTypes.string,
  labelLower: PropTypes.string,
  labelUpper: PropTypes.string,
};

export default function LegendThreshold({
  scale,
  domain,
  labelFormat = x => x,
  labelTransform,
  labelDelimiter = 'to',
  labelLower = 'Less than ',
  labelUpper = 'More than ',
  ...restProps
}) {
  domain = domain || scale.range();
  labelTransform =
    labelTransform ||
    defaultTransform({
      labelDelimiter,
      labelLower,
      labelUpper,
    });
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

function defaultTransform({
  labelDelimiter,
  labelLower,
  labelUpper,
}) {
  return ({ scale, labelFormat }) => {
    function format(labelFormat, value, i) {
      return labelFormat(value, i) || '';
    }
    return (d, i) => {
      let [x0, x1] = scale.invertExtent(d);
      let delimiter = ` ${labelDelimiter} `;
      let value = x1;
      if (!x0) {
        delimiter = labelLower;
      }
      if (!x1) {
        value = x0;
        x1 = x0;
        x0 = undefined;
        delimiter = labelUpper;
      }
      return {
        extent: [x0, x1],
        text: `${format(labelFormat, x0, i)}${delimiter}${format(
          labelFormat,
          x1,
          i,
        )}`,
        value: scale(value),
        datum: d,
        index: i,
      };
    };
  };
}
