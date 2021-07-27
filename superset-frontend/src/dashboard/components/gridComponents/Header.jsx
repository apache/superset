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
import { useSelector } from 'react-redux';

import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import DragHandle from 'src/dashboard/components/dnd/DragHandle';
import EditableTitle from 'src/components/EditableTitle';
import AnchorLink from 'src/components/AnchorLink';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import PopoverDropdown from 'src/components/PopoverDropdown';
import headerStyleOptions from 'src/dashboard/util/headerStyleOptions';
import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
import { componentShape } from 'src/dashboard/util/propShapes';
import {
  SMALL_HEADER,
  BACKGROUND_TRANSPARENT,
} from 'src/dashboard/util/constants';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  depth: PropTypes.number.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,
  filters: PropTypes.object.isRequired,

  // redux
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {};

const Header = ({
  component,
  depth,
  parentComponent,
  updateComponents,
  deleteComponent,
  id,
  parentId,
  index,
  handleComponentDrop,
  editMode,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const dashboardFilters = useSelector(state => state.dashboardFilters);

  const filters = useMemo(() => getActiveFilters(), [dashboardFilters]);

  const handleChangeFocus = useCallback(nextFocus => {
    setIsFocused(nextFocus);
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

  const handleChangeSize = useCallback(
    value => {
      handleUpdateMeta('headerSize', value);
    },
    [handleUpdateMeta],
  );

  const handleChangeBackground = useCallback(
    value => {
      handleUpdateMeta('background', value);
    },
    [handleUpdateMeta],
  );

  const handleChangeText = useCallback(
    value => {
      handleUpdateMeta('text', value);
    },
    [handleUpdateMeta],
  );

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const headerStyle = useMemo(
    () =>
      headerStyleOptions.find(
        opt => opt.value === (component.meta.headerSize || SMALL_HEADER),
      ),
    [component.meta.headerSize],
  );

  const rowStyle = useMemo(
    () =>
      backgroundStyleOptions.find(
        opt =>
          opt.value === (component.meta.background || BACKGROUND_TRANSPARENT),
      ),
    [component.meta.background],
  );

  const menuItems = useMemo(
    () => [
      <PopoverDropdown
        id={`${component.id}-header-style`}
        options={headerStyleOptions}
        value={component.meta.headerSize}
        onChange={handleChangeSize}
      />,
      <BackgroundStyleDropdown
        id={`${component.id}-background`}
        value={component.meta.background}
        onChange={handleChangeBackground}
      />,
      <DeleteComponentButton onDelete={handleDeleteComponent} />,
    ],
    [
      component.id,
      component.meta.background,
      component.meta.headerSize,
      handleChangeBackground,
      handleChangeSize,
      handleDeleteComponent,
    ],
  );

  const titleClass = useMemo(
    () =>
      cx(
        'dashboard-component',
        'dashboard-component-header',
        headerStyle.className,
        rowStyle.className,
      ),
    [headerStyle.className, rowStyle.className],
  );

  const renderDraggableContent = useCallback(
    ({ dropIndicatorProps, dragSourceRef }) => (
      <div ref={dragSourceRef}>
        {editMode &&
          depth <= 2 && ( // drag handle looks bad when nested
            <HoverMenu position="left">
              <DragHandle position="left" />
            </HoverMenu>
          )}

        <WithPopoverMenu
          onChangeFocus={handleChangeFocus}
          menuItems={menuItems}
          editMode={editMode}
        >
          <div className={titleClass}>
            <EditableTitle
              title={component.meta.text}
              canEdit={editMode}
              onSaveTitle={handleChangeText}
              showTooltip={false}
            />
            {!editMode && (
              <AnchorLink
                anchorLinkId={component.id}
                filters={filters}
                showShortLinkButton
              />
            )}
          </div>
        </WithPopoverMenu>

        {dropIndicatorProps && <div {...dropIndicatorProps} />}
      </div>
    ),
    [
      component.id,
      component.meta.text,
      depth,
      editMode,
      filters,
      handleChangeFocus,
      handleChangeText,
      menuItems,
      titleClass,
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
      disableDragDrop={isFocused}
      editMode={editMode}
    >
      {renderDraggableContent}
    </DragDroppable>
  );
};

Header.propTypes = propTypes;
Header.defaultProps = defaultProps;

export default React.memo(Header);
