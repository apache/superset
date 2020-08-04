import { css, StyleSheet } from 'aphrodite';
import React from 'react';
import PropTypes from 'prop-types';

import { withBoundingRects, withBoundingRectsProps } from '@vx/bounds';

const DEFAULT_WIDTH = 200;

const styles = StyleSheet.create({
  tooltip: {
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: 100,
    background: 'white',
    border: '1px solid #eaeaea',
    padding: 8,
    borderRadius: 4,
    fontFamily: 'BlinkMacSystemFont,Roboto,Helvetica Neue,sans-serif',
    fontSize: 12,
  },
});

const propTypes = {
  ...withBoundingRectsProps,
  left: PropTypes.number.isRequired,
  top: PropTypes.number.isRequired,
  detectOverflowX: PropTypes.bool,
  detectOverflowY: PropTypes.bool,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  children: PropTypes.node,
};

const defaultProps = {
  width: DEFAULT_WIDTH,
  detectOverflowX: true,
  detectOverflowY: true,
  children: null,
};

function Tooltip({
  left: initialLeft,
  top: initialTop,
  width,
  rect,
  parentRect,
  detectOverflowX,
  detectOverflowY,
  children,
}) {
  let left = initialLeft;
  let top = initialTop;

  if (rect && parentRect) {
    left = detectOverflowX && rect.right > parentRect.right ? left - rect.width : left;
    top = detectOverflowY && rect.bottom > parentRect.bottom ? top - rect.height : top;
  }

  return (
    <div className={css(styles.tooltip)} style={{ top, left, width }}>
      {children}
    </div>
  );
}

Tooltip.propTypes = propTypes;
Tooltip.defaultProps = defaultProps;

export default withBoundingRects(Tooltip);
