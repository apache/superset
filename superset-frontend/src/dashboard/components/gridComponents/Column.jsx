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
import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import Icons from 'src/components/Icons';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import DragHandle from 'src/dashboard/components/dnd/DragHandle';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import IconButton from 'src/dashboard/components/IconButton';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
import { componentShape } from 'src/dashboard/util/propShapes';
import { BACKGROUND_TRANSPARENT } from 'src/dashboard/util/constants';

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

const Column = ({
  deleteComponent,
  id,
  parentId,
  updateComponents,
  component,
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
  isComponentVisible,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const handleChangeFocus = useCallback(nextFocus => {
    setIsFocused(Boolean(nextFocus));
  }, []);

  const handleUpdateMeta = useCallback(
    (metaKey, nextValue) => {
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
    },
    [component, updateComponents],
  );

  const handleChangeBackground = useCallback(
    value => {
      handleUpdateMeta('background', value);
    },
    [handleUpdateMeta],
  );

  const columnItems = useMemo(() => component.children || [], [
    component.children,
  ]);

  const backgroundStyle = useMemo(
    () =>
      backgroundStyleOptions.find(
        opt =>
          opt.value === (component.meta.background || BACKGROUND_TRANSPARENT),
      ),
    [component.meta.background],
  );

  const menuItems = useMemo(
    () => [
      <BackgroundStyleDropdown
        id={`${component.id}-background`}
        value={component.meta.background}
        onChange={handleChangeBackground}
      />,
    ],
    [component.id, component.meta.background, handleChangeBackground],
  );

  const renderDraggableContent = useCallback(
    ({ dropIndicatorProps, dragSourceRef }) => (
      <ResizableContainer
        id={component.id}
        adjustableWidth
        adjustableHeight={false}
        widthStep={columnWidth}
        widthMultiple={component.meta.width}
        minWidthMultiple={minColumnWidth}
        maxWidthMultiple={availableColumnCount + (component.meta.width || 0)}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeStop={onResizeStop}
        editMode={editMode}
      >
        <WithPopoverMenu
          isFocused={isFocused}
          onChangeFocus={handleChangeFocus}
          disableClick
          menuItems={menuItems}
          editMode={editMode}
        >
          {editMode && (
            <HoverMenu innerRef={dragSourceRef} position="top">
              <DragHandle position="top" />
              <DeleteComponentButton onDelete={handleDeleteComponent} />
              <IconButton
                onClick={handleChangeFocus}
                icon={<Icons.Cog iconSize="xl" />}
              />
            </HoverMenu>
          )}
          <div
            className={cx(
              'grid-column',
              columnItems.length === 0 && 'grid-column--empty',
              backgroundStyle.className,
            )}
          >
            {columnItems.map((componentId, itemIndex) => (
              <DashboardComponent
                key={componentId}
                id={componentId}
                parentId={component.id}
                depth={depth + 1}
                index={itemIndex}
                availableColumnCount={component.meta.width}
                columnWidth={columnWidth}
                onResizeStart={onResizeStart}
                onResize={onResize}
                onResizeStop={onResizeStop}
                isComponentVisible={isComponentVisible}
              />
            ))}

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </div>
        </WithPopoverMenu>
      </ResizableContainer>
    ),
    [
      availableColumnCount,
      backgroundStyle.className,
      columnItems,
      columnWidth,
      component.id,
      component.meta.width,
      depth,
      editMode,
      handleChangeFocus,
      handleDeleteComponent,
      isComponentVisible,
      isFocused,
      menuItems,
      minColumnWidth,
      onResize,
      onResizeStart,
      onResizeStop,
    ],
  );

  return (
    <DragDroppable
      component={component}
      parentComponent={parentComponent}
      orientation="column"
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {renderDraggableContent}
    </DragDroppable>
  );
};

Column.propTypes = propTypes;
Column.defaultProps = defaultProps;

export default React.memo(Column);
