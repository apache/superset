/* eslint react/forbid-prop-types: 0 */
import PropTypes from 'prop-types';
import React from 'react';
import { withBoundingRects, withBoundingRectsProps } from '@vx/bounds';

import Tooltip from './Tooltip';

const propTypes = {
  ...withBoundingRectsProps,
  ...Tooltip.propTypes,
};

const defaultProps = {};

function TooltipWithBounds({
  left: initialLeft,
  top: initialTop,
  rect,
  parentRect,
  children,
  style,
}) {
  let left = initialLeft;
  let top = initialTop;

  if (rect && parentRect) {
    left = rect.right > parentRect.right ? (left - rect.width) : left;
    top = rect.bottom > parentRect.bottom ? (top - rect.height) : top;
  }

  return (
    <Tooltip style={{ top, left, ...style }}>
      {children}
    </Tooltip>
  );
}

TooltipWithBounds.propTypes = propTypes;
TooltipWithBounds.defaultProps = defaultProps;

export default withBoundingRects(TooltipWithBounds);
