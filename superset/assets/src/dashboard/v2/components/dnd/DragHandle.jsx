import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

const propTypes = {
  position: PropTypes.oneOf(['left', 'top']),
  innerRef: PropTypes.func,
  dotCount: PropTypes.number,
};

const defaultProps = {
  position: 'left',
  innerRef: null,
  dotCount: 8,
};

export default class DragHandle extends React.PureComponent {
  render() {
    const { innerRef, position, dotCount } = this.props;
    return (
      <div
        ref={innerRef}
        className={cx(
          'drag-handle',
          position === 'left' && 'drag-handle--left',
          position === 'top' && 'drag-handle--top',
        )}
      >
        {Array(dotCount)
          .fill(null)
          .map((_, i) => (
            <div key={`handle-dot-${i}`} className="drag-handle-dot" />
          ))}
      </div>
    );
  }
}

DragHandle.propTypes = propTypes;
DragHandle.defaultProps = defaultProps;
