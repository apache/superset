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
import {
  Fragment,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  memo,
} from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import {
  css,
  FAST_DEBOUNCE,
  FeatureFlag,
  isFeatureEnabled,
  styled,
  t,
} from '@superset-ui/core';

import {
  Draggable,
  Droppable,
} from 'src/dashboard/components/dnd/DragDroppable';
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
import { EMPTY_CONTAINER_Z_INDEX } from 'src/dashboard/constants';
import { isCurrentUserBot } from 'src/utils/isBot';
import { useDebouncedEffect } from '../../../explore/exploreUtils';

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
  maxChildrenHeight: PropTypes.number.isRequired,

  // dnd
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const GridRow = styled.div`
  ${({ theme, editMode }) => css`
    position: relative;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: flex-start;
    width: 100%;
    height: fit-content;

    & > :not(:last-child):not(.hover-menu) {
      ${!editMode && `margin-right: ${theme.gridUnit * 4}px;`}
    }

    & .empty-droptarget {
      position: relative;
      align-self: center;
      &.empty-droptarget--vertical {
        min-width: ${theme.gridUnit * 4}px;
        &:not(:last-child) {
          width: ${theme.gridUnit * 4}px;
        }
        &:first-child:not(.droptarget-side) {
          z-index: ${EMPTY_CONTAINER_Z_INDEX};
          position: absolute;
          width: 100%;
          height: 100%;
        }
      }
      &.droptarget-side {
        z-index: ${EMPTY_CONTAINER_Z_INDEX};
        position: absolute;
        width: ${theme.gridUnit * 4}px;
        &:first-child {
          inset-inline-start: 0;
        }
      }
    }

    &.grid-row--empty {
      min-height: ${theme.gridUnit * 25}px;
    }
  `}
`;

const emptyRowContentStyles = theme => css`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.text.label};
`;

const Row = props => {
  const {
    component: rowComponent,
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
    onChangeTab,
    isComponentVisible,
    updateComponents,
    deleteComponent,
    parentId,
  } = props;

  const [isFocused, setIsFocused] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hoverMenuHovered, setHoverMenuHovered] = useState(false);
  const [containerHeight, setContainerHeight] = useState(null);
  const containerRef = useRef();
  const isComponentVisibleRef = useRef(isComponentVisible);

  useEffect(() => {
    isComponentVisibleRef.current = isComponentVisible;
  }, [isComponentVisible]);

  // if chart not rendered - render it if it's less than 1 view height away from current viewport
  // if chart rendered - remove it if it's more than 4 view heights away from current viewport
  useEffect(() => {
    let observerEnabler;
    let observerDisabler;
    if (
      isFeatureEnabled(FeatureFlag.DashboardVirtualization) &&
      !isCurrentUserBot()
    ) {
      observerEnabler = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && isComponentVisibleRef.current) {
            setIsInView(true);
          }
        },
        {
          rootMargin: '100% 0px',
        },
      );
      observerDisabler = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting && isComponentVisibleRef.current) {
            setIsInView(false);
          }
        },
        {
          rootMargin: '400% 0px',
        },
      );
      const element = containerRef.current;
      if (element) {
        observerEnabler.observe(element);
        observerDisabler.observe(element);
      }
    }
    return () => {
      observerEnabler?.disconnect();
      observerDisabler?.disconnect();
    };
  }, []);

  useDebouncedEffect(
    () => {
      const updatedHeight = containerRef.current?.clientHeight;
      if (
        editMode &&
        containerRef.current &&
        updatedHeight !== containerHeight
      ) {
        setContainerHeight(updatedHeight);
      }
    },
    FAST_DEBOUNCE,
    [editMode, containerHeight],
  );

  const handleChangeFocus = useCallback(nextFocus => {
    setIsFocused(Boolean(nextFocus));
  }, []);

  const handleChangeBackground = useCallback(
    nextValue => {
      const metaKey = 'background';
      if (nextValue && rowComponent.meta[metaKey] !== nextValue) {
        updateComponents({
          [rowComponent.id]: {
            ...rowComponent,
            meta: {
              ...rowComponent.meta,
              [metaKey]: nextValue,
            },
          },
        });
      }
    },
    [updateComponents, rowComponent],
  );

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(rowComponent.id, parentId);
  }, [deleteComponent, rowComponent, parentId]);

  const handleMenuHover = useCallback(hovered => {
    const { isHovered } = hovered;
    setHoverMenuHovered(isHovered);
  }, []);

  const rowItems = useMemo(
    () => rowComponent.children || [],
    [rowComponent.children],
  );

  const backgroundStyle = backgroundStyleOptions.find(
    opt =>
      opt.value === (rowComponent.meta.background || BACKGROUND_TRANSPARENT),
  );
  const remainColumnCount = availableColumnCount - occupiedColumnCount;
  const renderChild = useCallback(
    ({ dragSourceRef }) => (
      <WithPopoverMenu
        isFocused={isFocused}
        onChangeFocus={handleChangeFocus}
        disableClick
        menuItems={[
          <BackgroundStyleDropdown
            id={`${rowComponent.id}-background`}
            value={backgroundStyle.value}
            onChange={handleChangeBackground}
          />,
        ]}
        editMode={editMode}
      >
        {editMode && (
          <HoverMenu
            onHover={handleMenuHover}
            innerRef={dragSourceRef}
            position="left"
          >
            <DragHandle position="left" />
            <DeleteComponentButton onDelete={handleDeleteComponent} />
            <IconButton
              onClick={handleChangeFocus}
              icon={<Icons.Cog iconSize="xl" />}
            />
          </HoverMenu>
        )}
        <GridRow
          className={cx(
            'grid-row',
            rowItems.length === 0 && 'grid-row--empty',
            hoverMenuHovered && 'grid-row--hovered',
            backgroundStyle.className,
          )}
          data-test={`grid-row-${backgroundStyle.className}`}
          ref={containerRef}
          editMode={editMode}
        >
          {editMode && (
            <Droppable
              {...(rowItems.length === 0
                ? {
                    component: rowComponent,
                    parentComponent: rowComponent,
                    dropToChild: true,
                  }
                : {
                    component: rowItems[0],
                    parentComponent: rowComponent,
                  })}
              depth={depth}
              index={0}
              orientation="row"
              onDrop={handleComponentDrop}
              className={cx(
                'empty-droptarget',
                'empty-droptarget--vertical',
                rowItems.length > 0 && 'droptarget-side',
              )}
              editMode
              style={{
                height: rowItems.length > 0 ? containerHeight : '100%',
                ...(rowItems.length > 0 && { width: 16 }),
              }}
            >
              {({ dropIndicatorProps }) =>
                dropIndicatorProps && <div {...dropIndicatorProps} />
              }
            </Droppable>
          )}
          {rowItems.length === 0 && (
            <div css={emptyRowContentStyles}>{t('Empty row')}</div>
          )}
          {rowItems.length > 0 &&
            rowItems.map((componentId, itemIndex) => (
              <Fragment key={componentId}>
                <DashboardComponent
                  key={componentId}
                  id={componentId}
                  parentId={rowComponent.id}
                  depth={depth + 1}
                  index={itemIndex}
                  availableColumnCount={remainColumnCount}
                  columnWidth={columnWidth}
                  onResizeStart={onResizeStart}
                  onResize={onResize}
                  onResizeStop={onResizeStop}
                  isComponentVisible={isComponentVisible}
                  onChangeTab={onChangeTab}
                  isInView={isInView}
                />
                {editMode && (
                  <Droppable
                    component={rowItems}
                    parentComponent={rowComponent}
                    depth={depth}
                    index={itemIndex + 1}
                    orientation="row"
                    onDrop={handleComponentDrop}
                    className={cx(
                      'empty-droptarget',
                      'empty-droptarget--vertical',
                      remainColumnCount === 0 &&
                        itemIndex === rowItems.length - 1 &&
                        'droptarget-side',
                    )}
                    editMode
                    style={{
                      height: containerHeight,
                      ...(remainColumnCount === 0 &&
                        itemIndex === rowItems.length - 1 && { width: 16 }),
                    }}
                  >
                    {({ dropIndicatorProps }) =>
                      dropIndicatorProps && <div {...dropIndicatorProps} />
                    }
                  </Droppable>
                )}
              </Fragment>
            ))}
        </GridRow>
      </WithPopoverMenu>
    ),
    [
      backgroundStyle.className,
      backgroundStyle.value,
      columnWidth,
      containerHeight,
      depth,
      editMode,
      handleChangeBackground,
      handleChangeFocus,
      handleComponentDrop,
      handleDeleteComponent,
      handleMenuHover,
      hoverMenuHovered,
      isComponentVisible,
      isFocused,
      isInView,
      onChangeTab,
      onResize,
      onResizeStart,
      onResizeStop,
      remainColumnCount,
      rowComponent,
      rowItems,
    ],
  );

  return (
    <Draggable
      component={rowComponent}
      parentComponent={parentComponent}
      orientation="row"
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {renderChild}
    </Draggable>
  );
};

Row.propTypes = propTypes;

export default memo(Row);
