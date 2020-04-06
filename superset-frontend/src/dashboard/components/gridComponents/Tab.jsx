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
import React from 'react';
import PropTypes from 'prop-types';

import DashboardComponent from '../../containers/DashboardComponent';
import DragDroppable from '../dnd/DragDroppable';
import EditableTitle from '../../../components/EditableTitle';
import AnchorLink from '../../../components/AnchorLink';
import DeleteComponentModal from '../DeleteComponentModal';
import WithPopoverMenu from '../menu/WithPopoverMenu';
import { componentShape } from '../../util/propShapes';

export const RENDER_TAB = 'RENDER_TAB';
export const RENDER_TAB_CONTENT = 'RENDER_TAB_CONTENT';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  renderType: PropTypes.oneOf([RENDER_TAB, RENDER_TAB_CONTENT]).isRequired,
  onDropOnTab: PropTypes.func,
  onDeleteTab: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  filters: PropTypes.object.isRequired,

  // grid related
  availableColumnCount: PropTypes.number,
  columnWidth: PropTypes.number,
  onResizeStart: PropTypes.func,
  onResize: PropTypes.func,
  onResizeStop: PropTypes.func,

  // redux
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  setDirectPathToChild: PropTypes.func.isRequired,
};

const defaultProps = {
  availableColumnCount: 0,
  columnWidth: 0,
  onDropOnTab() {},
  onDeleteTab() {},
  onResizeStart() {},
  onResize() {},
  onResizeStop() {},
};

export default class Tab extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
    };
    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleChangeText = this.handleChangeText.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    this.handleTopDropTargetDrop = this.handleTopDropTargetDrop.bind(this);
    this.handleChangeTab = this.handleChangeTab.bind(this);
  }

  handleChangeFocus(nextFocus) {
    this.setState(() => ({ isFocused: nextFocus }));
  }

  handleChangeTab({ pathToTabIndex }) {
    this.props.setDirectPathToChild(pathToTabIndex);
  }

  handleChangeText(nextTabText) {
    const { updateComponents, component } = this.props;
    if (nextTabText && nextTabText !== component.meta.text) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            text: nextTabText,
          },
        },
      });
    }
  }

  handleDeleteComponent() {
    const { index, id, parentId } = this.props;
    this.props.deleteComponent(id, parentId);
    this.props.onDeleteTab(index);
  }

  handleDrop(dropResult) {
    this.props.handleComponentDrop(dropResult);
    this.props.onDropOnTab(dropResult);
  }

  handleTopDropTargetDrop(dropResult) {
    if (dropResult) {
      this.props.handleComponentDrop({
        ...dropResult,
        destination: {
          ...dropResult.destination,
          // force appending as the first child if top drop target
          index: 0,
        },
      });
    }
  }

  renderTabContent() {
    const {
      component: tabComponent,
      parentComponent: tabParentComponent,
      depth,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
      editMode,
      isComponentVisible,
    } = this.props;

    return (
      <div className="dashboard-component-tabs-content">
        {/* Make top of tab droppable */}
        {editMode && (
          <DragDroppable
            component={tabComponent}
            parentComponent={tabParentComponent}
            orientation="column"
            index={0}
            depth={depth}
            onDrop={this.handleTopDropTargetDrop}
            editMode
            className="empty-droptarget"
          >
            {({ dropIndicatorProps }) =>
              dropIndicatorProps && (
                <div className="drop-indicator drop-indicator--top" />
              )
            }
          </DragDroppable>
        )}
        {tabComponent.children.map((componentId, componentIndex) => (
          <DashboardComponent
            key={componentId}
            id={componentId}
            parentId={tabComponent.id}
            depth={depth} // see isValidChild.js for why tabs don't increment child depth
            index={componentIndex}
            onDrop={this.handleDrop}
            availableColumnCount={availableColumnCount}
            columnWidth={columnWidth}
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeStop={onResizeStop}
            isComponentVisible={isComponentVisible}
            onChangeTab={this.handleChangeTab}
          />
        ))}
        {/* Make bottom of tab droppable */}
        {editMode && (
          <DragDroppable
            component={tabComponent}
            parentComponent={tabParentComponent}
            orientation="column"
            index={tabComponent.children.length}
            depth={depth}
            onDrop={this.handleDrop}
            editMode
            className="empty-droptarget"
          >
            {({ dropIndicatorProps }) =>
              dropIndicatorProps && (
                <div className="drop-indicator drop-indicator--bottom" />
              )
            }
          </DragDroppable>
        )}
      </div>
    );
  }

  renderTab() {
    const { isFocused } = this.state;
    const {
      component,
      parentComponent,
      index,
      depth,
      editMode,
      filters,
    } = this.props;
    const deleteTabIcon = (
      <div className="icon-button">
        <span className="fa fa-trash" />
      </div>
    );

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation="column"
        index={index}
        depth={depth}
        onDrop={this.handleDrop}
        editMode={editMode}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <div className="dragdroppable-tab" ref={dragSourceRef}>
            <WithPopoverMenu
              onChangeFocus={this.handleChangeFocus}
              menuItems={
                parentComponent.children.length <= 1
                  ? []
                  : [
                      <DeleteComponentModal
                        triggerNode={deleteTabIcon}
                        onDelete={this.handleDeleteComponent}
                      />,
                    ]
              }
              editMode={editMode}
            >
              <EditableTitle
                title={component.meta.text}
                canEdit={editMode && isFocused}
                onSaveTitle={this.handleChangeText}
                showTooltip={false}
              />
              {!editMode && (
                <AnchorLink
                  anchorLinkId={component.id}
                  filters={filters}
                  showShortLinkButton
                  placement={index >= 5 ? 'left' : 'right'}
                />
              )}
            </WithPopoverMenu>

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </div>
        )}
      </DragDroppable>
    );
  }

  render() {
    const { renderType } = this.props;
    return renderType === RENDER_TAB
      ? this.renderTab()
      : this.renderTabContent();
  }
}

Tab.propTypes = propTypes;
Tab.defaultProps = defaultProps;
