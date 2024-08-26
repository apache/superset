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
import { createRef, PureComponent, Fragment } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { debounce } from 'lodash';
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

class Row extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
      isInView: false,
      hoverMenuHovered: false,
    };
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleUpdateMeta = this.handleUpdateMeta.bind(this);
    this.handleChangeBackground = this.handleUpdateMeta.bind(
      this,
      'background',
    );
    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleMenuHover = this.handleMenuHover.bind(this);
    this.setVerticalEmptyContainerHeight = debounce(
      this.setVerticalEmptyContainerHeight.bind(this),
      FAST_DEBOUNCE,
    );

    this.containerRef = createRef();
    this.observerEnabler = null;
    this.observerDisabler = null;
  }

  // if chart not rendered - render it if it's less than 1 view height away from current viewport
  // if chart rendered - remove it if it's more than 4 view heights away from current viewport
  componentDidMount() {
    if (
      isFeatureEnabled(FeatureFlag.DashboardVirtualization) &&
      !isCurrentUserBot()
    ) {
      this.observerEnabler = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !this.state.isInView) {
            this.setState({ isInView: true });
          }
        },
        {
          rootMargin: '100% 0px',
        },
      );
      this.observerDisabler = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting && this.state.isInView) {
            this.setState({ isInView: false });
          }
        },
        {
          rootMargin: '400% 0px',
        },
      );
      const element = this.containerRef.current;
      if (element) {
        this.observerEnabler.observe(element);
        this.observerDisabler.observe(element);
        this.setVerticalEmptyContainerHeight();
      }
    }
  }

  componentDidUpdate() {
    this.setVerticalEmptyContainerHeight();
  }

  setVerticalEmptyContainerHeight() {
    const { containerHeight } = this.state;
    const { editMode } = this.props;
    const updatedHeight = this.containerRef.current?.clientHeight;
    if (
      editMode &&
      this.containerRef.current &&
      updatedHeight !== containerHeight
    ) {
      this.setState({ containerHeight: updatedHeight });
    }
  }

  componentWillUnmount() {
    this.observerEnabler?.disconnect();
    this.observerDisabler?.disconnect();
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

  handleMenuHover = hovered => {
    const { isHovered } = hovered;
    this.setState(() => ({ hoverMenuHovered: isHovered }));
  };

  render() {
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
    } = this.props;
    const { containerHeight, hoverMenuHovered } = this.state;

    const rowItems = rowComponent.children || [];

    const backgroundStyle = backgroundStyleOptions.find(
      opt =>
        opt.value === (rowComponent.meta.background || BACKGROUND_TRANSPARENT),
    );
    const remainColumnCount = availableColumnCount - occupiedColumnCount;

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
        {({ dragSourceRef }) => (
          <WithPopoverMenu
            isFocused={this.state.isFocused}
            onChangeFocus={this.handleChangeFocus}
            disableClick
            menuItems={[
              <BackgroundStyleDropdown
                id={`${rowComponent.id}-background`}
                value={backgroundStyle.value}
                onChange={this.handleChangeBackground}
              />,
            ]}
            editMode={editMode}
          >
            {editMode && (
              <HoverMenu
                onHover={this.handleMenuHover}
                innerRef={dragSourceRef}
                position="left"
              >
                <DragHandle position="left" />
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />
                <IconButton
                  onClick={this.handleChangeFocus}
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
              ref={this.containerRef}
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
                      isInView={this.state.isInView}
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
        )}
      </Draggable>
    );
  }
}

Row.propTypes = propTypes;

export default Row;
