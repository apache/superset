import React from 'react';
import PropTypes from 'prop-types';
import Legend from './Legend';

LegendQuantile.propTypes = {
  scale: PropTypes.func.isRequired,
  domain: PropTypes.array,
  labelFormat: PropTypes.func,
  labelTransform: PropTypes.func,
  labelDelimiter: PropTypes.string,
};

export default function LegendQuantile({
  scale,
  domain,
  labelFormat = x => x,
  labelTransform,
  labelDelimiter = '-',
  ...restProps
}) {
  domain = domain || scale.range();
  labelTransform =
    labelTransform || defaultTransform({ labelDelimiter });
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

function defaultTransform({ labelDelimiter }) {
  return ({ scale, labelFormat }) => {
    return (d, i) => {
      const [x0, x1] = scale.invertExtent(d);
      return {
        extent: [x0, x1],
        text: `${labelFormat(x0, i)} ${labelDelimiter} ${labelFormat(
          x1,
          i,
        )}`,
        value: scale(x0),
        datum: d,
        index: i,
      };
    };
  };
}
