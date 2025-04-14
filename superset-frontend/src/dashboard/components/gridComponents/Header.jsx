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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { css, styled } from '@superset-ui/core';

import PopoverDropdown from 'src/components/PopoverDropdown';
import EditableTitle from 'src/components/EditableTitle';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import DragHandle from 'src/dashboard/components/dnd/DragHandle';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import headerStyleOptions from 'src/dashboard/util/headerStyleOptions';
import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
import { componentShape } from 'src/dashboard/util/propShapes';
import {
  SMALL_HEADER,
  BACKGROUND_TRANSPARENT,
} from 'src/dashboard/util/constants';

const propTypes = {
  id: PropTypes.string.isRequired,
  dashboardId: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  depth: PropTypes.number.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,
  embeddedMode: PropTypes.bool.isRequired,

  // redux
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {};

const HeaderStyles = styled.div`
  ${({ theme }) => css`
    font-weight: ${theme.typography.weights.bold};
    width: 100%;
    padding: ${theme.gridUnit * 4}px 0;

    &.header-small {
      font-size: ${theme.typography.sizes.l}px;
    }

    &.header-medium {
      font-size: ${theme.typography.sizes.xl}px;
    }

    &.header-large {
      font-size: ${theme.typography.sizes.xxl}px;
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
        border: 1px dashed ${theme.colors.primary.base};
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
      margin-bottom: ${theme.gridUnit * -4}px;
    }

    .background--white &,
    &.background--white,
    .dashboard-component-tabs & {
      padding-left: ${theme.gridUnit * 4}px;
      padding-right: ${theme.gridUnit * 4}px;
    }
  `}
`;

class Header extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
    };
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleUpdateMeta = this.handleUpdateMeta.bind(this);
    this.handleChangeSize = this.handleUpdateMeta.bind(this, 'headerSize');
    this.handleChangeBackground = this.handleUpdateMeta.bind(
      this,
      'background',
    );
    this.handleChangeText = this.handleUpdateMeta.bind(this, 'text');
  }

  handleChangeFocus(nextFocus) {
    this.setState(() => ({ isFocused: nextFocus }));
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
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  render() {
    const { isFocused } = this.state;

    const {
      dashboardId,
      component,
      depth,
      parentComponent,
      index,
      handleComponentDrop,
      editMode,
      embeddedMode,
    } = this.props;

    const headerStyle = headerStyleOptions.find(
      opt => opt.value === (component.meta.headerSize || SMALL_HEADER),
    );

    const rowStyle = backgroundStyleOptions.find(
      opt =>
        opt.value === (component.meta.background || BACKGROUND_TRANSPARENT),
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
        {({ dragSourceRef }) => (
          <div ref={dragSourceRef}>
            {editMode &&
              depth <= 2 && ( // drag handle looks bad when nested
                <HoverMenu position="left">
                  <DragHandle position="left" />
                </HoverMenu>
              )}
            <WithPopoverMenu
              onChangeFocus={this.handleChangeFocus}
              menuItems={[
                <PopoverDropdown
                  id={`${component.id}-header-style`}
                  options={headerStyleOptions}
                  value={component.meta.headerSize}
                  onChange={this.handleChangeSize}
                />,
                <BackgroundStyleDropdown
                  id={`${component.id}-background`}
                  value={component.meta.background}
                  onChange={this.handleChangeBackground}
                />,
              ]}
              editMode={editMode}
            >
              <HeaderStyles
                className={cx(
                  'dashboard-component',
                  'dashboard-component-header',
                  headerStyle.className,
                  rowStyle.className,
                )}
              >
                {editMode && (
                  <HoverMenu position="top">
                    <DeleteComponentButton
                      onDelete={this.handleDeleteComponent}
                    />
                  </HoverMenu>
                )}
                <EditableTitle
                  title={component.meta.text}
                  canEdit={editMode}
                  onSaveTitle={this.handleChangeText}
                  showTooltip={false}
                />
                {!editMode && !embeddedMode && (
                  <AnchorLink id={component.id} dashboardId={dashboardId} />
                )}
              </HeaderStyles>
            </WithPopoverMenu>
          </div>
        )}
      </Draggable>
    );
  }
}

Header.propTypes = propTypes;
Header.defaultProps = defaultProps;

export default Header;
