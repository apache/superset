/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { PureComponent, Fragment } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { css, styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import {
  Draggable,
  Droppable,
} from 'src/dashboard/components/dnd/DragDroppable';
import DragHandle from 'src/dashboard/components/dnd/DragHandle';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import IconButton from 'src/dashboard/components/IconButton';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
import { componentShape } from 'src/dashboard/util/propShapes';
import { BACKGROUND_TRANSPARENT } from 'src/dashboard/util/constants';
import { EMPTY_CONTAINER_Z_INDEX } from 'src/dashboard/constants';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,

  // grid related
  availableColumnCount: PropTypes.number.isRequired,
  columnWidth: PropTypes.number.isRequired,
  minColumnWidth: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  deleteComponent: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {};

const ColumnStyles = styled.div`
  ${({ theme, editMode }) => css`
    &.grid-column {
      width: 100%;
      position: relative;

      & > :not(.hover-menu):not(:last-child) {
        ${!editMode && `margin-bottom: ${theme.gridUnit * 4}px;`}
      }
    }

    .dashboard--editing &:after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      z-index: 1;
      pointer-events: none;
      border: 1px dashed ${theme.colors.grayscale.light2};
    }
    .dashboard--editing .resizable-container--resizing:hover > &:after,
    .dashboard--editing .hover-menu:hover + &:after {
      border: 1px dashed ${theme.colors.primary.base};
      z-index: 2;
    }

    & .empty-droptarget {
      &.droptarget-edge {
        position: absolute;
        z-index: ${EMPTY_CONTAINER_Z_INDEX};
        &:first-child {
          inset-block-start: 0;
        }
      }
      &:first-child:not(.droptarget-edge) {
        position: absolute;
        z-index: ${EMPTY_CONTAINER_Z_INDEX};
        width: 100%;
        height: 100%;
      }
    }
  `}
`;

const emptyColumnContentStyles = theme => css`
  min-height: ${theme.gridUnit * 25}px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.text.label};
`;

class Column extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
    };
    this.handleChangeBackground = this.handleUpdateMeta.bind(
      this,
      'background',
    );
    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
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

  render() {
    const {
      component: columnComponent,
      parentComponent,
      index,
      availableColumnCount,
      columnWidth,
      minColumnWidth,
      depth,
      onResizeStart,
      onResize,
      onResizeStop,
      handleComponentDrop,
      editMode,
      onChangeTab,
      isComponentVisible,
    } = this.props;

    const columnItems = columnComponent.children || [];
    const backgroundStyle = backgroundStyleOptions.find(
      opt =>
        opt.value ===
        (columnComponent.meta.background || BACKGROUND_TRANSPARENT),
    );

    return (
      <Draggable
        component={columnComponent}
        parentComponent={parentComponent}
        orientation="column"
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        editMode={editMode}
      >
        {({ dragSourceRef }) => (
          <ResizableContainer
            id={columnComponent.id}
            adjustableWidth
            adjustableHeight={false}
            widthStep={columnWidth}
            widthMultiple={columnComponent.meta.width}
            minWidthMultiple={minColumnWidth}
            maxWidthMultiple={
              availableColumnCount + (columnComponent.meta.width || 0)
            }
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeStop={onResizeStop}
            editMode={editMode}
          >
            <WithPopoverMenu
              isFocused={this.state.isFocused}
              onChangeFocus={this.handleChangeFocus}
              disableClick
              menuItems={[
                <BackgroundStyleDropdown
                  id={`${columnComponent.id}-background`}
                  value={columnComponent.meta.background}
                  onChange={this.handleChangeBackground}
                />,
              ]}
              editMode={editMode}
            >
              {editMode && (
                <HoverMenu innerRef={dragSourceRef} position="top">
                  <DragHandle position="top" />
                  <DeleteComponentButton
                    onDelete={this.handleDeleteComponent}
                  />
                  <IconButton
                    onClick={this.handleChangeFocus}
                    icon={<Icons.Cog iconSize="xl" />}
                  />
                </HoverMenu>
              )}
              <ColumnStyles
                className={cx('grid-column', backgroundStyle.className)}
                editMode={editMode}
              >
                {editMode && (
                  <Droppable
                    component={columnComponent}
                    parentComponent={columnComponent}
                    {...(columnItems.length === 0
                      ? {
                          dropToChild: true,
                        }
                      : {
                          component: columnItems[0],
                        })}
                    depth={depth}
                    index={0}
                    orientation="column"
                    onDrop={handleComponentDrop}
                    className={cx(
                      'empty-droptarget',
                      columnItems.length > 0 && 'droptarget-edge',
                    )}
                    editMode
                  >
                    {({ dropIndicatorProps }) =>
                      dropIndicatorProps && <div {...dropIndicatorProps} />
                    }
                  </Droppable>
                )}
                {columnItems.length === 0 ? (
                  <div css={emptyColumnContentStyles}>{t('Empty column')}</div>
                ) : (
                  columnItems.map((componentId, itemIndex) => (
                    <Fragment key={componentId}>
                      <DashboardComponent
                        id={componentId}
                        parentId={columnComponent.id}
                        depth={depth + 1}
                        index={itemIndex}
                        availableColumnCount={columnComponent.meta.width}
                        columnWidth={columnWidth}
                        onResizeStart={onResizeStart}
                        onResize={onResize}
                        onResizeStop={onResizeStop}
                        isComponentVisible={isComponentVisible}
                        onChangeTab={onChangeTab}
                      />
                      {editMode && (
                        <Droppable
                          component={columnItems}
                          parentComponent={columnComponent}
                          depth={depth}
                          index={itemIndex + 1}
                          orientation="column"
                          onDrop={handleComponentDrop}
                          className={cx(
                            'empty-droptarget',
                            itemIndex === columnItems.length - 1 &&
                              'droptarget-edge',
                          )}
                          editMode
                        >
                          {({ dropIndicatorProps }) =>
                            dropIndicatorProps && (
                              <div {...dropIndicatorProps} />
                            )
                          }
                        </Droppable>
                      )}
                    </Fragment>
                  ))
                )}
              </ColumnStyles>
            </WithPopoverMenu>
          </ResizableContainer>
        )}
      </Draggable>
    );
  }
}

Column.propTypes = propTypes;
Column.defaultProps = defaultProps;

export default Column;
