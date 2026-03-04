/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useState, useCallback, memo } from 'react';
import cx from 'classnames';
import { css, styled } from '@apache-superset/core/ui';

import PopoverDropdown from '@superset-ui/core/components/PopoverDropdown';
import { EditableTitle } from '@superset-ui/core/components';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import DragHandle from 'src/dashboard/components/dnd/DragHandle';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import headerStyleOptions from 'src/dashboard/util/headerStyleOptions';
import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
import {
  SMALL_HEADER,
  BACKGROUND_TRANSPARENT,
  MEDIUM_HEADER,
  LARGE_HEADER,
  BACKGROUND_WHITE,
} from 'src/dashboard/util/constants';
import * as componentTypes from 'src/dashboard/util/componentTypes';

export type ComponentType =
  (typeof componentTypes)[keyof typeof componentTypes];

export type HeaderStyleValue =
  | typeof SMALL_HEADER
  | typeof MEDIUM_HEADER
  | typeof LARGE_HEADER;

export type BackgroundStyleValue =
  | typeof BACKGROUND_TRANSPARENT
  | typeof BACKGROUND_WHITE;

export interface ComponentMeta {
  width?: number;
  height?: number;
  text: string;
  headerSize?: HeaderStyleValue;
  background?: BackgroundStyleValue;
  chartId?: number;
  [key: string]: any;
}

export interface ComponentShape {
  id: string;
  type: ComponentType;
  parents?: string[];
  children?: string[];
  meta: ComponentMeta;
}

interface HeaderProps {
  id: string;
  dashboardId: string;
  parentId: string;
  component: ComponentShape;
  depth: number;
  parentComponent: ComponentShape;
  index: number;
  editMode: boolean;
  embeddedMode: boolean;
  handleComponentDrop: (dropResult: any) => void;
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: (changes: Record<string, ComponentShape>) => void;
}

const HeaderStyles = styled.div`
  ${({ theme }) => css`
    font-weight: ${theme.fontWeightStrong};
    width: 100%;
    padding: ${theme.sizeUnit * 4}px 0;

    &.header-small {
      font-size: ${theme.fontSizeLG}px;
    }

    &.header-medium {
      font-size: ${theme.fontSizeXL}px;
    }

    &.header-large {
      font-size: ${theme.fontSizeXXL}px;
    }

    .anchor-link-container {
      display: inline;
      line-height: 0;
      vertical-align: bottom; /* trick to align the anchor with text */
      opacity: 0;
      transition: opacity ${theme.motionDurationMid} ease-in-out;
    }

    &:hover .anchor-link-container {
      opacity: 1;
    }

    .dashboard--editing .dashboard-grid & {
      &:after {
        border: 1px dashed transparent;
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        z-index: 1;
        pointer-events: none;
      }

      &:hover:after {
        border: 1px dashed ${theme.colorPrimary};
        z-index: 2;
      }
    }

    .dashboard--editing .dragdroppable-row & {
      cursor: move;
    }

    /**
   * grids add margin between items, so don't double pad within columns
   * we'll not worry about double padding on top as it can serve as a visual separator
   */
    .grid-column > :not(:last-child) & {
      margin-bottom: ${theme.sizeUnit * -4}px;
    }

    .background--white &,
    &.background--white,
    .dashboard-component-tabs & {
      padding-left: ${theme.sizeUnit * 4}px;
      padding-right: ${theme.sizeUnit * 4}px;
    }
  `}
`;

function Header({
  id,
  dashboardId,
  parentId,
  component,
  depth,
  parentComponent,
  index,
  editMode,
  embeddedMode,
  handleComponentDrop,
  deleteComponent,
  updateComponents,
}: HeaderProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeFocus = useCallback((nextFocus: boolean): void => {
    setIsFocused(nextFocus);
  }, []);

  const handleUpdateMeta = useCallback(
    (metaKey: keyof ComponentMeta, nextValue: string): void => {
      if (nextValue && component.meta[metaKey] !== nextValue) {
        updateComponents({
          [component.id]: {
            ...component,
            meta: {
              ...component.meta,
              [metaKey]: nextValue,
            },
          },
        } as Record<string, ComponentShape>);
      }
    },
    [component, updateComponents],
  );

  const handleChangeSize = useCallback(
    (nextValue: string) => handleUpdateMeta('headerSize', nextValue),
    [handleUpdateMeta],
  );

  const handleChangeBackground = useCallback(
    (nextValue: string) => handleUpdateMeta('background', nextValue),
    [handleUpdateMeta],
  );

  const handleChangeText = useCallback(
    (nextValue: string) => handleUpdateMeta('text', nextValue),
    [handleUpdateMeta],
  );

  const handleDeleteComponent = useCallback((): void => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const headerStyle = headerStyleOptions.find(
    opt => opt.value === (component.meta.headerSize || SMALL_HEADER),
  );

  const rowStyle = backgroundStyleOptions.find(
    opt => opt.value === (component.meta.background || BACKGROUND_TRANSPARENT),
  );

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation="row"
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      disableDragDrop={isFocused}
      editMode={editMode}
    >
      {({
        dragSourceRef,
      }: {
        dragSourceRef: React.Ref<HTMLDivElement> | undefined;
      }) => (
        <div ref={dragSourceRef}>
          {editMode &&
            depth <= 2 && ( // drag handle looks bad when nested
              <HoverMenu position="left">
                <DragHandle position="left" />
              </HoverMenu>
            )}
          <WithPopoverMenu
            onChangeFocus={handleChangeFocus}
            menuItems={[
              <PopoverDropdown
                id={`${component.id}-header-style`}
                options={headerStyleOptions}
                value={component.meta.headerSize as string}
                onChange={handleChangeSize}
              />,
              <BackgroundStyleDropdown
                id={`${component.id}-background`}
                value={component.meta.background as string}
                onChange={handleChangeBackground}
              />,
            ]}
            editMode={editMode}
          >
            <HeaderStyles
              className={cx(
                'dashboard-component',
                'dashboard-component-header',
                headerStyle?.className,
                rowStyle?.className,
              )}
            >
              {editMode && (
                <HoverMenu position="top">
                  <DeleteComponentButton onDelete={handleDeleteComponent} />
                </HoverMenu>
              )}
              <EditableTitle
                title={component.meta.text}
                canEdit={editMode}
                onSaveTitle={handleChangeText}
                showTooltip={false}
              />
              {!editMode && !embeddedMode && (
                <AnchorLink
                  id={component.id}
                  dashboardId={Number(dashboardId)}
                />
              )}
            </HeaderStyles>
          </WithPopoverMenu>
        </div>
      )}
    </Draggable>
  );
}

export default memo(Header);
