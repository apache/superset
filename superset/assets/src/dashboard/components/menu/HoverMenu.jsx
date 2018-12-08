import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

const propTypes = {
  position: PropTypes.oneOf(['left', 'top']),
  innerRef: PropTypes.func,
  children: PropTypes.node,
};

const defaultProps = {
  position: 'left',
  innerRef: null,
  children: null,
};

export default class HoverMenu extends React.PureComponent {
  render() {
    const { innerRef, position, children } = this.props;
    return (
      <div
        ref={innerRef}
        className={cx(
          'hover-menu',
          position === 'left' && 'hover-menu--left',
          position === 'top' && 'hover-menu--top',
        )}
      >
        {children}
      </div>
    );
  }
}

HoverMenu.propTypes = propTypes;
HoverMenu.defaultProps = defaultProps;
