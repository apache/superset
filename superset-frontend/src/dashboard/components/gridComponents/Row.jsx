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

import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import DragHandle from 'src/dashboard/components/dnd/DragHandle';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import Icons from 'src/components/Icons';
import IconButton from 'src/dashboard/components/IconButton';
import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import { componentShape } from 'src/dashboard/util/propShapes';
import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
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
  occupiedColumnCount: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const Row = ({
  updateComponents,
  component,
  deleteComponent,
  parentId,
  parentComponent,
  index,
  availableColumnCount,
  columnWidth,
  occupiedColumnCount,
  depth,
  onResizeStart,
  onResize,
  onResizeStop,
  handleComponentDrop,
  editMode,
  isComponentVisible,
}) => {
  const [isFocused, setIsFocused] = useState(false);

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

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(component.id, parentId);
  }, [component.id, deleteComponent, parentId]);

  const rowItems = component.children || [];

  const backgroundStyle = useMemo(
    () =>
      backgroundStyleOptions.find(
        opt =>
          opt.value === (component.meta.background || BACKGROUND_TRANSPARENT),
      ),
    [component.meta.background],
  );

  const rowClass = useMemo(
    () =>
      cx(
        'grid-row',
        rowItems.length === 0 && 'grid-row--empty',
        backgroundStyle.className,
      ),
    [backgroundStyle.className, rowItems.length],
  );

  const menuItems = useMemo(
    () => [
      <BackgroundStyleDropdown
        id={`${component.id}-background`}
        value={backgroundStyle.value}
        onChange={handleChangeBackground}
      />,
    ],
    [backgroundStyle.value, component.id, handleChangeBackground],
  );

  const renderDraggableContent = useCallback(
    ({ dropIndicatorProps, dragSourceRef }) => (
      <WithPopoverMenu
        isFocused={isFocused}
        onChangeFocus={handleChangeFocus}
        disableClick
        menuItems={menuItems}
        editMode={editMode}
      >
        {editMode && (
          <HoverMenu innerRef={dragSourceRef} position="left">
            <DragHandle position="left" />
            <DeleteComponentButton onDelete={handleDeleteComponent} />
            <IconButton
              onClick={handleChangeFocus}
              icon={<Icons.Cog iconSize="xl" />}
            />
          </HoverMenu>
        )}
        <div
          className={rowClass}
          data-test={`grid-row-${backgroundStyle.className}`}
        >
          {rowItems.map((componentId, itemIndex) => (
            <DashboardComponent
              key={componentId}
              id={componentId}
              parentId={component.id}
              depth={depth + 1}
              index={itemIndex}
              availableColumnCount={availableColumnCount - occupiedColumnCount}
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
    ),
    [
      availableColumnCount,
      backgroundStyle.className,
      columnWidth,
      component.id,
      depth,
      editMode,
      handleChangeFocus,
      handleDeleteComponent,
      isComponentVisible,
      isFocused,
      menuItems,
      occupiedColumnCount,
      onResize,
      onResizeStart,
      onResizeStop,
      rowClass,
      rowItems,
    ],
  );
  return (
    <DragDroppable
      component={component}
      parentComponent={parentComponent}
      orientation="row"
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {renderDraggableContent}
    </DragDroppable>
  );
};

Row.propTypes = propTypes;

export default React.memo(Row);
