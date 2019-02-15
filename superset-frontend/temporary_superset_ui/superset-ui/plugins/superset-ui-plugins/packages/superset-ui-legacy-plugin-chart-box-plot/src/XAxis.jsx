import React from 'react';
import PropTypes from 'prop-types';
import { AxisBottom, AxisTop } from '@vx/axis';
import { axisStylesShape, tickStylesShape } from '@data-ui/xy-chart/esm/utils/propShapes';

const propTypes = {
  axisStyles: axisStylesShape,
  hideZero: PropTypes.bool,
  label: PropTypes.string,
  labelOffset: PropTypes.number,
  labelProps: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  numTicks: PropTypes.number,
  orientation: PropTypes.oneOf(['bottom', 'top']),
  rangePadding: PropTypes.number,
  tickStyles: tickStylesShape,
  tickComponent: PropTypes.func,
  tickLabelProps: PropTypes.func,
  tickFormat: PropTypes.func,
  tickValues: PropTypes.arrayOf(
    // number or date/moment object
    PropTypes.oneOfType([PropTypes.number, PropTypes.object, PropTypes.string]),
  ),

  // probably injected by parent
  innerHeight: PropTypes.number,
  scale: PropTypes.func,
};

const defaultProps = {
  axisStyles: {},
  hideZero: false,
  innerHeight: null,
  label: null,
  labelOffset: 14,
  labelProps: null,
  numTicks: null,
  orientation: 'bottom',
  rangePadding: null,
  scale: null,
  tickComponent: null,
  tickFormat: null,
  tickLabelProps: null,
  tickStyles: {},
  tickValues: undefined,
};

export default class XAxis extends React.PureComponent {
  render() {
    const {
      axisStyles,
      innerHeight,
      hideZero,
      label,
      labelOffset,
      labelProps,
      numTicks,
      orientation,
      rangePadding,
      scale,
      tickComponent,
      tickFormat,
      tickLabelProps: passedTickLabelProps,
      tickStyles,
      tickValues,
    } = this.props;
    if (!scale || !innerHeight) return null;
    const Axis = orientation === 'bottom' ? AxisBottom : AxisTop;

    let tickLabelProps = passedTickLabelProps;
    if (!tickLabelProps) {
      tickLabelProps =
        tickStyles.label && tickStyles.label[orientation]
          ? () => tickStyles.label[orientation]
          : undefined;
    }

    return (
      <Axis
        top={orientation === 'bottom' ? innerHeight : 0}
        left={0}
        rangePadding={rangePadding}
        hideTicks={numTicks === 0}
        hideZero={hideZero}
        label={label}
        labelOffset={labelOffset}
        labelProps={labelProps || (axisStyles.label || {})[orientation]}
        numTicks={numTicks}
        scale={scale}
        stroke={axisStyles.stroke}
        strokeWidth={axisStyles.strokeWidth}
        tickComponent={tickComponent}
        tickFormat={tickFormat}
        tickLabelProps={tickLabelProps}
        tickLength={tickStyles.tickLength}
        tickStroke={tickStyles.stroke}
        tickValues={tickValues}
      />
    );
  }
}

XAxis.propTypes = propTypes;
XAxis.defaultProps = defaultProps;
XAxis.displayName = 'XAxis';
