import React from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';

import ItemTypes from '../ItemTypes';

const splitTarget = {
  drop(props, monitor) {
    props.onDrop(monitor.getItem());
  },
};

function collect(connect, monitor) {
  return {
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
  };
}

const propTypes = {
  connectDropTarget: PropTypes.func.isRequired,
  isOver: PropTypes.bool.isRequired,
  canDrop: PropTypes.bool.isRequired,
  accepts: PropTypes.arrayOf(PropTypes.string).isRequired,
  onDrop: PropTypes.func,

  name: PropTypes.string.isRequired,
};

function ColumnDropTarget(props) {
  const { name, connectDropTarget, children } = props;
  return connectDropTarget(
    <div className="col-lg-12 column-drop-bar">
      <div className="list-group-item">
        <h4 className="col-lg-1">{name}</h4>
        <div className="col-lg-11">
          {children}
        </div>
      </div>
    </div>,
  );
}

ColumnDropTarget.propTypes = propTypes;
export default DropTarget(ItemTypes.DIMENSION, splitTarget, collect)(ColumnDropTarget);
