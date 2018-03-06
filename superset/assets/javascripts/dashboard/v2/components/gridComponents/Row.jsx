import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import DragDroppable from '../dnd/DragDroppable';
import DragHandle from '../dnd/DragHandle';
import DashboardComponent from '../../containers/DashboardComponent';
import DeleteComponentButton from '../DeleteComponentButton';
import HoverMenu from '../menu/HoverMenu';
import IconButton from '../IconButton';
import RowStyleDropdown from '../menu/RowStyleDropdown';
import WithPopoverMenu from '../menu/WithPopoverMenu';

import { componentShape } from '../../util/propShapes';
import rowStyleOptions from '../../util/rowStyleOptions';
import { GRID_GUTTER_SIZE, ROW_TRANSPARENT } from '../../util/constants';

const GUTTER = 'GUTTER';

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
  occupiedColumnCount: PropTypes.number.isRequired,
  occupiedRowCount: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {
  rowHeight: null,
};

class Row extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
    };
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleUpdateMeta = this.handleUpdateMeta.bind(this);
    this.handleChangeRowStyle = this.handleUpdateMeta.bind(this, 'rowStyle');
    this.handleChangeFocus = this.handleChangeFocus.bind(this);
  }

  handleChangeFocus(nextFocus) {
    this.setState(() => ({ isFocused: Boolean(nextFocus) }));
  }

  handleUpdateMeta(metaKey, nextValue) {
    const { updateComponents, component } = this.props;
    if (nextValue && component.meta[metaKey] !== nextValue) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            [metaKey]: nextValue,
          },
        },
      });
    }
  }

  handleDeleteComponent() {
    const { deleteComponent, component, parentId } = this.props;
    deleteComponent(component.id, parentId);
  }

  render() {
    const {
      component: rowComponent,
      parentComponent,
      index,
      availableColumnCount,
      columnWidth,
      occupiedColumnCount,
      occupiedRowCount,
      depth,
      onResizeStart,
      onResize,
      onResizeStop,
      handleComponentDrop,
    } = this.props;

    const rowItems = [];

    // this adds a gutter between each child in the row.
    (rowComponent.children || []).forEach((id, childIndex) => {
      rowItems.push(id);
      if (childIndex < rowComponent.children.length - 1) {
        rowItems.push(GUTTER);
      }
    });

    const rowStyle = rowStyleOptions.find(
      opt => opt.value === (rowComponent.meta.rowStyle || ROW_TRANSPARENT),
    );

    return (
      <DragDroppable
        component={rowComponent}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        onDrop={handleComponentDrop}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <WithPopoverMenu
            isFocused={this.state.isFocused}
            onChangeFocus={this.handleChangeFocus}
            disableClick
            menuItems={[
              <RowStyleDropdown
                id={`${rowComponent.id}-row-style`}
                value={rowComponent.meta.rowStyle}
                onChange={this.handleChangeRowStyle}
              />,
            ]}
          >

            <div
              className={cx(
                'grid-row',
                rowItems.length === 0 && 'grid-row--empty',
                rowStyle.className,
              )}
            >
              <HoverMenu innerRef={dragSourceRef} position="left">
                <DragHandle position="left" />
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />
                <IconButton
                  onClick={this.handleChangeFocus}
                  className="fa fa-cog"
                />
              </HoverMenu>

              {rowItems.map((componentId, itemIndex) => {
                if (componentId === GUTTER) {
                  return <div key={`gutter-${itemIndex}`} style={{ width: GRID_GUTTER_SIZE }} />;
                }

                return (
                  <DashboardComponent
                    key={componentId}
                    id={componentId}
                    parentId={rowComponent.id}
                    depth={depth + 1}
                    index={itemIndex / 2} // account for gutters!
                    availableColumnCount={availableColumnCount - occupiedColumnCount}
                    occupiedRowCount={occupiedRowCount}
                    columnWidth={columnWidth}
                    onResizeStart={onResizeStart}
                    onResize={onResize}
                    onResizeStop={onResizeStop}
                  />
                );
              })}

              {dropIndicatorProps && <div {...dropIndicatorProps} />}
            </div>
          </WithPopoverMenu>
        )}
      </DragDroppable>
    );
  }
}

Row.propTypes = propTypes;
Row.defaultProps = defaultProps;

export default Row;
