import { Group } from '@vx/group';
import PropTypes from 'prop-types';
import React from 'react';

import WithTooltip, { withTooltipPropTypes } from '@data-ui/shared/build/enhancer/WithTooltip';

export const propTypes = {
  ...withTooltipPropTypes,
  ariaLabel: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
  renderTooltip: PropTypes.func,
};

const defaultProps = {
  margin: {
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
  },
  renderTooltip: null,
};

export default function RadialChart(props) {
  if (props.renderTooltip) {
    return (
      <WithTooltip renderTooltip={props.renderTooltip}>
        <RadialChart {...props} renderTooltip={null} />
      </WithTooltip>
    );
  }

  const {
    ariaLabel,
    children,
    width,
    height,
    margin,
    onMouseMove,
    onMouseLeave,
  } = props;

  const completeMargin = { ...defaultProps.margin, ...margin };
  const innerWidth = width - completeMargin.left - completeMargin.right;
  const innerHeight = height - completeMargin.top - completeMargin.bottom;
  const radius = Math.min(innerWidth, innerHeight) / 2;
  if (innerWidth < 10 || innerHeight < 10) return null;

  return (
    <svg
      aria-label={ariaLabel}
      role="img"
      width={width}
      height={height}
    >
      <Group
        top={(height / 2) - completeMargin.top}
        left={(width / 2) + margin.left}
      >
        {React.Children.map(children, Child => (
          React.cloneElement(Child, {
            onMouseMove: Child.props.onMouseMove || onMouseMove,
            onMouseLeave: Child.props.onMouseLeave || onMouseLeave,
            radius,
          })
        ))}
      </Group>
    </svg>
  );
}

RadialChart.propTypes = propTypes;
RadialChart.defaultProps = defaultProps;
RadialChart.displayName = 'RadialChart';
