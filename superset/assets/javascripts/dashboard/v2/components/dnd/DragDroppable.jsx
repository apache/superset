import React from 'react';
import PropTypes from 'prop-types';
import { DragSource, DropTarget } from 'react-dnd';
import cx from 'classnames';

import { dragConfig, dropConfig } from './dragDroppableConfig';
import { componentShape } from '../../util/propShapes';


const propTypes = {
  children: PropTypes.func,
  component: componentShape.isRequired,
  parentComponent: componentShape,
  disableDragDrop: PropTypes.bool,
  orientation: PropTypes.oneOf(['row', 'column']),
  index: PropTypes.number.isRequired,

  // from react-dnd
  isDragging: PropTypes.bool.isRequired,
  isDraggingOver: PropTypes.bool.isRequired,
  isDraggingOverShallow: PropTypes.bool.isRequired,
  droppableRef: PropTypes.func.isRequired,
  dragSourceRef: PropTypes.func.isRequired,
  dragPreviewRef: PropTypes.func.isRequired,

  // from redux
  onDrop: PropTypes.func,
};

const defaultProps = {
  parentComponent: null,
  disableDragDrop: false,
  children() {},
  onDrop() {},
  orientation: 'row',
};

class DragDroppable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dropIndicator: null, // this gets set/modified by the react-dnd HOCs
    };
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  render() {
    const {
      children,
      orientation,
      droppableRef,
      dragSourceRef,
      dragPreviewRef,
      isDragging,
      isDraggingOver,
    } = this.props;

    const { dropIndicator } = this.state;

    return (
      <div
        ref={(ref) => {
          this.ref = ref;
          dragPreviewRef(ref);
          droppableRef(ref);
        }}
        className={cx(
          'dragdroppable',
          orientation === 'row' && 'dragdroppable-row',
          orientation === 'column' && 'dragdroppable-column',
          isDragging && 'dragdroppable--dragging',
        )}
      >
        {children({
          dragSourceRef,
          dropIndicatorProps: isDraggingOver && dropIndicator && {
            className: 'drop-indicator',
            style: dropIndicator,
          },
        })}
      </div>
    );
  }
}

DragDroppable.propTypes = propTypes;
DragDroppable.defaultProps = defaultProps;

// note that the composition order here determines using
// component.method() vs decoratedComponentInstance.method() in the drag/drop config
export default DropTarget(...dropConfig)(
  DragSource(...dragConfig)(DragDroppable),
);
