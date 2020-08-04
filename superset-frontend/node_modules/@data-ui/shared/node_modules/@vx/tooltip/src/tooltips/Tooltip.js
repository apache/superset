import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

export default function Tooltip({ className, top, left, style, children, ...restProps }) {
  return (
    <div
      className={cx('vx-tooltip-portal', className)}
      style={{
        position: 'absolute',
        backgroundColor: 'white',
        color: '#666666',
        padding: '.3rem .5rem',
        borderRadius: '3px',
        fontSize: '14px',
        boxShadow: '0 1px 2px rgba(33,33,33,0.2)',
        lineHeight: '1em',
        pointerEvents: 'none',
        top,
        left,
        ...style
      }}
      {...restProps}
    >
      {children}
    </div>
  );
}

Tooltip.propTypes = {
  left: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  top: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  style: PropTypes.object,
  children: PropTypes.any,
};
