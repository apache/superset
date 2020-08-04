import React from 'react';
import PropTypes from 'prop-types';
import { AxisLeft, AxisRight } from '@vx/axis';

import { numTicksForHeight } from '../utils/scale-utils';
import { yAxisStyles, yTickStyles } from '../theme';

const propTypes = {
  hideZero: PropTypes.bool,
  label: PropTypes.string,
  labelProps: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  labelOffset: PropTypes.number,
  numTicks: PropTypes.number,
  orientation: PropTypes.oneOf(['left', 'right']),
  rangePadding: PropTypes.number,
  tickLabelProps: PropTypes.func,
  tickFormat: PropTypes.func,
  scale: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
};

const defaultProps = {
  hideZero: false,
  label: null,
  labelProps: null,
  labelOffset: 0,
  numTicks: null,
  orientation: 'left',
  rangePadding: null,
  tickFormat: null,
  tickLabelProps: null,
};

export default function YAxis({
  hideZero,
  width,
  label,
  labelProps,
  labelOffset,
  numTicks,
  orientation,
  rangePadding,
  scale,
  tickFormat,
  tickLabelProps: passedTickLabelProps,
}) {
  const Axis = orientation === 'left' ? AxisLeft : AxisRight;
  const height = Math.max(...scale.range());
  const tickLabelProps = passedTickLabelProps || (() => yTickStyles.label[orientation]);

  return (
    <Axis
      top={0}
      left={orientation === 'right' ? width : 0}
      rangePadding={rangePadding}
      hideTicks={numTicks === 0}
      hideZero={hideZero}
      label={label}
      labelProps={labelProps || yAxisStyles.label[orientation]}
      labelOffset={labelOffset}
      numTicks={numTicksForHeight(height)}
      scale={scale}
      stroke={yAxisStyles.stroke}
      strokeWidth={yAxisStyles.strokeWidth}
      tickFormat={tickFormat}
      tickLength={yTickStyles.tickLength}
      tickStroke={yTickStyles.stroke}
      tickLabelProps={tickLabelProps}
    />
  );
}

YAxis.width = 50;
YAxis.propTypes = propTypes;
YAxis.defaultProps = defaultProps;
YAxis.displayName = 'YAxis';
