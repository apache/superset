import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import DashboardComponent from '../../containers/DashboardComponent';
import DeleteComponentButton from '../DeleteComponentButton';
import DragDroppable from '../dnd/DragDroppable';
import DragHandle from '../dnd/DragHandle';
import HoverMenu from '../menu/HoverMenu';
import ResizableContainer from '../resizable/ResizableContainer';
import { componentShape } from '../../util/propShapes';

import { GRID_GUTTER_SIZE, GRID_MIN_COLUMN_COUNT } from '../../util/constants';

const GUTTER = 'GUTTER';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  // occupiedRowCount: PropTypes.number,

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
  // occupiedRowCount: null,
};

class Column extends React.PureComponent {
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
      component: columnComponent,
      parentComponent,
      index,
      availableColumnCount,
      columnWidth,
      // occupiedRowCount,
      depth,
      onResizeStart,
      onResize,
      onResizeStop,
      handleComponentDrop,
    } = this.props;

    const columnItems = [];

    (columnComponent.children || []).forEach((id, childIndex) => {
      columnItems.push(id);
      if (childIndex < columnComponent.children.length - 1) {
        columnItems.push(GUTTER);
      }
    });

    return (
      <DragDroppable
        component={columnComponent}
        parentComponent={parentComponent}
        orientation="column"
        index={index}
        onDrop={handleComponentDrop}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <ResizableContainer
            id={columnComponent.id}
            adjustableWidth
            adjustableHeight={false}
            widthStep={columnWidth}
            widthMultiple={columnComponent.meta.width}
            // heightMultiple={occupiedRowCount}
            minWidthMultiple={GRID_MIN_COLUMN_COUNT}
            maxWidthMultiple={availableColumnCount + (columnComponent.meta.width || 0)}
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeStop={onResizeStop}
          >
            <div
              className={cx(
                'grid-column',
                columnItems.length === 0 && 'grid-column--empty',
              )}
            >
              <HoverMenu innerRef={dragSourceRef} position="top">
                <DragHandle position="top" />
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />
              </HoverMenu>

              {columnItems.map((componentId, itemIndex) => {
                if (componentId === GUTTER) {
                  return <div key={`gutter-${itemIndex}`} style={{ height: GRID_GUTTER_SIZE }} />;
                }

                return (
                  <DashboardComponent
                    key={componentId}
                    id={componentId}
                    parentId={columnComponent.id}
                    depth={depth + 1}
                    index={itemIndex / 2} // account for gutters!
                    availableColumnCount={availableColumnCount}
                    columnWidth={columnWidth}
                    onResizeStart={onResizeStart}
                    onResize={onResize}
                    onResizeStop={onResizeStop}
                  />
                );
              })}

              {dropIndicatorProps && <div {...dropIndicatorProps} />}
            </div>
          </ResizableContainer>
        )}
      </DragDroppable>

    );
  }
}

Column.propTypes = propTypes;
Column.defaultProps = defaultProps;

export default Column;
