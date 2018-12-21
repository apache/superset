import React from 'react';
import PropTypes from 'prop-types';
import { Tabs as BootstrapTabs, Tab as BootstrapTab } from 'react-bootstrap';

import DragDroppable from '../dnd/DragDroppable';
import DragHandle from '../dnd/DragHandle';
import DashboardComponent from '../../containers/DashboardComponent';
import DeleteComponentButton from '../DeleteComponentButton';
import HoverMenu from '../menu/HoverMenu';
import { componentShape } from '../../util/propShapes';
import { NEW_TAB_ID, DASHBOARD_ROOT_ID } from '../../util/constants';
import { RENDER_TAB, RENDER_TAB_CONTENT } from './Tab';
import { TAB_TYPE } from '../../util/componentTypes';

const NEW_TAB_INDEX = -1;
const MAX_TAB_COUNT = 7;

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  renderTabContent: PropTypes.bool, // whether to render tabs + content or just tabs
  editMode: PropTypes.bool.isRequired,
  renderHoverMenu: PropTypes.bool,

  // grid related
  availableColumnCount: PropTypes.number,
  columnWidth: PropTypes.number,
  onResizeStart: PropTypes.func,
  onResize: PropTypes.func,
  onResizeStop: PropTypes.func,

  // dnd
  createComponent: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  onChangeTab: PropTypes.func,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {
  children: null,
  renderTabContent: true,
  renderHoverMenu: true,
  availableColumnCount: 0,
  columnWidth: 0,
  onChangeTab() {},
  onResizeStart() {},
  onResize() {},
  onResizeStop() {},
};

class Tabs extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      tabIndex: 0,
    };
    this.handleClickTab = this.handleClickTab.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleDeleteTab = this.handleDeleteTab.bind(this);
    this.handleDropOnTab = this.handleDropOnTab.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const maxIndex = Math.max(0, nextProps.component.children.length - 1);
    if (this.state.tabIndex > maxIndex) {
      this.setState(() => ({ tabIndex: maxIndex }));
    }
  }

  handleClickTab(tabIndex) {
    const { component, createComponent } = this.props;

    if (tabIndex === NEW_TAB_INDEX) {
      createComponent({
        destination: {
          id: component.id,
          type: component.type,
          index: component.children.length,
        },
        dragging: {
          id: NEW_TAB_ID,
          type: TAB_TYPE,
        },
      });
    } else if (tabIndex !== this.state.tabIndex) {
      this.setState(() => ({ tabIndex }));
      this.props.onChangeTab({ tabIndex, tabId: component.children[tabIndex] });
    }
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  handleDeleteTab(tabIndex) {
    this.handleClickTab(Math.max(0, tabIndex - 1));
  }

  handleDropOnTab(dropResult) {
    const { component } = this.props;

    // Ensure dropped tab is visible
    const { destination } = dropResult;
    if (destination) {
      const dropTabIndex =
        destination.id === component.id
          ? destination.index // dropped ON tabs
          : component.children.indexOf(destination.id); // dropped IN tab

      if (dropTabIndex > -1) {
        setTimeout(() => {
          this.handleClickTab(dropTabIndex);
        }, 30);
      }
    }
  }

  render() {
    const {
      depth,
      component: tabsComponent,
      parentComponent,
      index,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
      handleComponentDrop,
      renderTabContent,
      renderHoverMenu,
      editMode,
    } = this.props;

    const { tabIndex: selectedTabIndex } = this.state;
    const { children: tabIds } = tabsComponent;

    return (
      <DragDroppable
        component={tabsComponent}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        editMode={editMode}
      >
        {({
          dropIndicatorProps: tabsDropIndicatorProps,
          dragSourceRef: tabsDragSourceRef,
        }) => (
          <div className="dashboard-component dashboard-component-tabs">
            {editMode && renderHoverMenu && (
              <HoverMenu innerRef={tabsDragSourceRef} position="left">
                <DragHandle position="left" />
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />
              </HoverMenu>
            )}

            <BootstrapTabs
              id={tabsComponent.id}
              activeKey={selectedTabIndex}
              onSelect={this.handleClickTab}
              animation
              mountOnEnter
              unmountOnExit={false}
            >
              {tabIds.map((tabId, tabIndex) => (
                // react-bootstrap doesn't render a Tab if we move this to its own Tab.jsx so we
                // use `renderType` to indicate what the DashboardComponent should render. This
                // prevents us from passing the entire dashboard component lookup to render Tabs.jsx
                <BootstrapTab
                  key={tabId}
                  eventKey={tabIndex}
                  title={
                    <DashboardComponent
                      id={tabId}
                      parentId={tabsComponent.id}
                      depth={depth}
                      index={tabIndex}
                      renderType={RENDER_TAB}
                      availableColumnCount={availableColumnCount}
                      columnWidth={columnWidth}
                      onDropOnTab={this.handleDropOnTab}
                      onDeleteTab={this.handleDeleteTab}
                    />
                  }
                >
                  {renderTabContent && (
                    <DashboardComponent
                      id={tabId}
                      parentId={tabsComponent.id}
                      depth={depth} // see isValidChild.js for why tabs don't increment child depth
                      index={tabIndex}
                      renderType={RENDER_TAB_CONTENT}
                      availableColumnCount={availableColumnCount}
                      columnWidth={columnWidth}
                      onResizeStart={onResizeStart}
                      onResize={onResize}
                      onResizeStop={onResizeStop}
                      onDropOnTab={this.handleDropOnTab}
                    />
                  )}
                </BootstrapTab>
              ))}

              {editMode && tabIds.length < MAX_TAB_COUNT && (
                <BootstrapTab
                  eventKey={NEW_TAB_INDEX}
                  title={<div className="fa fa-plus" />}
                />
              )}
            </BootstrapTabs>

            {/* don't indicate that a drop on root is allowed when tabs already exist */}
            {tabsDropIndicatorProps &&
              parentComponent.id !== DASHBOARD_ROOT_ID && (
                <div {...tabsDropIndicatorProps} />
              )}
          </div>
        )}
      </DragDroppable>
    );
  }
}

Tabs.propTypes = propTypes;
Tabs.defaultProps = defaultProps;

export default Tabs;
