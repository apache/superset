import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import DragDroppable from '../../dnd/DragDroppable';

const propTypes = {
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
};

const defaultProps = {
  className: null,
};

export default class DraggableNewComponent extends React.PureComponent {
  render() {
    const { label, id, type, className } = this.props;
    return (
      <DragDroppable
        component={{ type, id }}
        parentComponent={null}
        index={0}
      >
        {({ dragSourceRef }) => (
          <div ref={dragSourceRef} className="new-component">
            <div className={cx('new-component-placeholder', className)} />
            {label}
          </div>
        )}
      </DragDroppable>
    );
  }
}

DraggableNewComponent.propTypes = propTypes;
DraggableNewComponent.defaultProps = defaultProps;
