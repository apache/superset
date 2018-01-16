import React from 'react';
import PropTypes from 'prop-types';
import { Tabs as BootstrapTabs, Tab as BootstrapTab } from 'react-bootstrap';

import DragDroppable from '../dnd/DragDroppable';
import DragHandle from '../dnd/DragHandle';
import DashboardComponent from '../../containers/DashboardComponent';
import DeleteComponentButton from '../DeleteComponentButton';
import HoverMenu from '../menu/HoverMenu';
import { componentShape } from '../../util/propShapes';
import { NEW_TAB_ID } from '../../util/constants';
import { RENDER_TAB, RENDER_TAB_CONTENT } from './Tab';

const NEW_TAB_INDEX = -1;
const MAX_TAB_COUNT = 5;

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,

  // grid related
  availableColumnCount: PropTypes.number.isRequired,
  columnWidth: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  createComponent: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  onChangeTab: PropTypes.func,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {
  onChangeTab: null,
  children: null,
};

class Tabs extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      tabIndex: 0,
    };
    this.handleClicKTab = this.handleClicKTab.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleDropOnTab = this.handleDropOnTab.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const maxIndex = Math.max(0, nextProps.component.children.length - 1);
    if (this.state.tabIndex > maxIndex) {
      this.setState(() => ({ tabIndex: maxIndex }));
    }
  }

  handleClicKTab(tabIndex) {
    const { onChangeTab, component, createComponent } = this.props;

    if (tabIndex !== NEW_TAB_INDEX && tabIndex !== this.state.tabIndex) {
      this.setState(() => ({ tabIndex }));
      if (onChangeTab) {
        onChangeTab({ tabIndex, tabId: component.children[tabIndex] });
      }
    } else if (tabIndex === NEW_TAB_INDEX) {
      createComponent({
        destination: {
          droppableId: component.id,
          index: component.children.length,
        },
        draggableId: NEW_TAB_ID,
      });
    }
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  handleDropOnTab(dropResult) {
    const { component } = this.props;

    // Ensure dropped tab is visible
    const { destination } = dropResult;
    if (destination) {
      const dropTabIndex = destination.droppableId === component.id
        ? destination.index // dropped ON tabs
        : component.children.indexOf(destination.droppableId); // dropped IN tab

      if (dropTabIndex > -1) {
        setTimeout(() => {
          this.handleClicKTab(dropTabIndex);
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
    } = this.props;

    const { tabIndex: selectedTabIndex } = this.state;
    const { children: tabIds } = tabsComponent;

    return (
      <DragDroppable
        component={tabsComponent}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        onDrop={handleComponentDrop}
      >
        {({ dropIndicatorProps: tabsDropIndicatorProps, dragSourceRef: tabsDragSourceRef }) => (
          <div className="dashboard-component dashboard-component-tabs">
            <HoverMenu innerRef={tabsDragSourceRef} position="left">
              <DragHandle position="left" />
              <DeleteComponentButton onDelete={this.handleDeleteComponent} />
            </HoverMenu>

            <BootstrapTabs
              id={tabsComponent.id}
              activeKey={selectedTabIndex}
              onSelect={this.handleClicKTab}
              animation={false}
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
                      onResizeStart={onResizeStart}
                      onResize={onResize}
                      onResizeStop={onResizeStop}
                      onDropOnTab={this.handleDropOnTab}
                    />
                  }
                >
                  {/*
                    react-bootstrap renders all children with display:none, so we don't
                    render potentially-expensive charts (this also enables lazy loading
                    their content)
                  */}
                  {tabIndex === selectedTabIndex &&
                    <DashboardComponent
                      id={tabId}
                      parentId={tabsComponent.id}
                      depth={depth}
                      index={tabIndex}
                      renderType={RENDER_TAB_CONTENT}
                      availableColumnCount={availableColumnCount}
                      columnWidth={columnWidth}
                      onResizeStart={onResizeStart}
                      onResize={onResize}
                      onResizeStop={onResizeStop}
                      onDropOnTab={this.handleDropOnTab}
                    />}
                </BootstrapTab>
              ))}

              {tabIds.length < MAX_TAB_COUNT &&
                <BootstrapTab
                  eventKey={NEW_TAB_INDEX}
                  title={<div className="fa fa-plus-square" />}
                />}

            </BootstrapTabs>

            {tabsDropIndicatorProps
              && tabsDropIndicatorProps.style
              && tabsDropIndicatorProps.style.width === '100%'
              && <div {...tabsDropIndicatorProps} />}

          </div>
        )}
      </DragDroppable>
    );
  }
}

Tabs.propTypes = propTypes;
Tabs.defaultProps = defaultProps;

export default Tabs;
