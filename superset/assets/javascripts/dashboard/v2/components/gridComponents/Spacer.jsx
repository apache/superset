import React from 'react';
import PropTypes from 'prop-types';

import DeleteComponentButton from '../DeleteComponentButton';
import DragDroppable from '../dnd/DragDroppable';
import HoverMenu from '../menu/HoverMenu';
import ResizableContainer from '../resizable/ResizableContainer';
import { componentShape } from '../../util/propShapes';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,

  // grid related
  availableColumnCount: PropTypes.number.isRequired,
  columnWidth: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  deleteComponent: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
};

const defaultProps = {
};

class Spacer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  render() {
    const {
      component,
      parentComponent,
      index,
      depth,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
      handleComponentDrop,
    } = this.props;

    const orientation = depth % 2 === 0 ? 'row' : 'column';
    const hoverMenuPosition = orientation === 'row' ? 'left' : 'top';
    const adjustableWidth = orientation === 'column';
    const adjustableHeight = orientation === 'row';

    console.log('spacer', availableColumnCount)

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation={orientation}
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <ResizableContainer
            id={component.id}
            adjustableWidth={adjustableWidth}
            adjustableHeight={adjustableHeight}
            widthStep={columnWidth}
            widthMultiple={component.meta.width || 1}
            heightMultiple={adjustableHeight ? component.meta.height || 1 : undefined}
            minWidthMultiple={1}
            minHeightMultiple={1}
            maxWidthMultiple={availableColumnCount + (component.meta.width || 0)}
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeStop={onResizeStop}
          >
            <HoverMenu position={hoverMenuPosition}>
              <DeleteComponentButton onDelete={this.handleDeleteComponent} />
            </HoverMenu>

            <div ref={dragSourceRef} className="grid-spacer" />

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </ResizableContainer>
        )}
      </DragDroppable>
    );
  }
}

Spacer.propTypes = propTypes;
Spacer.defaultProps = defaultProps;

export default Spacer;
