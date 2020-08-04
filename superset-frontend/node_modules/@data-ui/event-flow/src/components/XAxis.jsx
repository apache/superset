import React from 'react';
import PropTypes from 'prop-types';
import { AxisBottom, AxisTop } from '@vx/axis';

import { xAxisStyles, xTickStyles } from '../theme';
import { numTicksForWidth } from '../utils/scale-utils';

const propTypes = {
  hideZero: PropTypes.bool,
  label: PropTypes.string,
  labelProps: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  numTicks: PropTypes.number,
  orientation: PropTypes.oneOf(['bottom', 'top']),
  rangePadding: PropTypes.number,
  tickLabelProps: PropTypes.func,
  height: PropTypes.number.isRequired,
  scale: PropTypes.func.isRequired,
  tickFormat: PropTypes.func,
};

const defaultProps = {
  hideZero: false,
  label: null,
  labelProps: null,
  numTicks: null,
  orientation: 'top',
  rangePadding: null,
  tickLabelProps: null,
  tickFormat: null,
};

export default function XAxis({
  height,
  hideZero,
  label,
  labelProps,
  numTicks,
  orientation,
  rangePadding,
  scale,
  tickFormat,
  tickLabelProps: passedTickLabelProps,
}) {
  const Axis = orientation === 'bottom' ? AxisBottom : AxisTop;
  const width = Math.max(...scale.range());
  const tickLabelProps = passedTickLabelProps || (() => xTickStyles.label[orientation]);

  return (
    <Axis
      top={orientation === 'bottom' ? height : 0}
      left={0}
      rangePadding={rangePadding}
      hideTicks={numTicks === 0}
      hideZero={hideZero}
      label={label}
      labelProps={labelProps || xAxisStyles.label[orientation]}
      numTicks={numTicksForWidth(width)}
      scale={scale}
      stroke={xAxisStyles.stroke}
      strokeWidth={xAxisStyles.strokeWidth}
      tickFormat={tickFormat}
      tickLength={xTickStyles.tickLength}
      tickStroke={xTickStyles.stroke}
      tickLabelProps={tickLabelProps}
    />
  );
}

XAxis.height = 50;
XAxis.propTypes = propTypes;
XAxis.defaultProps = defaultProps;
XAxis.displayName = 'XAxis';
