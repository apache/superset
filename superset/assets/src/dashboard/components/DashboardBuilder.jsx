import cx from 'classnames';
import { DragDropContext } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
// ParentSize uses resize observer so the dashboard will update size
// when its container size changes, due to e.g., builder side panel opening
import ParentSize from '@vx/responsive/build/components/ParentSize';
import PropTypes from 'prop-types';
import React from 'react';
import { Sticky, StickyContainer } from 'react-sticky';
import { TabContainer, TabContent, TabPane } from 'react-bootstrap';

import BuilderComponentPane from './BuilderComponentPane';
import DashboardHeader from '../containers/DashboardHeader';
import DashboardGrid from '../containers/DashboardGrid';
import IconButton from './IconButton';
import DragDroppable from './dnd/DragDroppable';
import DashboardComponent from '../containers/DashboardComponent';
import ToastPresenter from '../containers/ToastPresenter';
import WithPopoverMenu from './menu/WithPopoverMenu';

import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
  DASHBOARD_ROOT_DEPTH,
} from '../util/constants';

const propTypes = {
  // redux
  dashboardLayout: PropTypes.object.isRequired,
  deleteTopLevelTabs: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  showBuilderPane: PropTypes.bool,
  handleComponentDrop: PropTypes.func.isRequired,
};

const defaultProps = {
  showBuilderPane: false,
};

class DashboardBuilder extends React.Component {
  static shouldFocusTabs(event, container) {
    // don't focus the tabs when we click on a tab
    return (
      event.target.tagName === 'UL' ||
      (/icon-button/.test(event.target.className) &&
        container.contains(event.target))
    );
  }

  constructor(props) {
    super(props);
    this.state = {
      tabIndex: 0, // top-level tabs
    };
    this.handleChangeTab = this.handleChangeTab.bind(this);
  }

  handleChangeTab({ tabIndex }) {
    this.setState(() => ({ tabIndex }));
  }

  render() {
    const {
      handleComponentDrop,
      dashboardLayout,
      deleteTopLevelTabs,
      editMode,
    } = this.props;

    const { tabIndex } = this.state;
    const dashboardRoot = dashboardLayout[DASHBOARD_ROOT_ID];
    const rootChildId = dashboardRoot.children[0];
    const topLevelTabs =
      rootChildId !== DASHBOARD_GRID_ID && dashboardLayout[rootChildId];

    const childIds = topLevelTabs ? topLevelTabs.children : [DASHBOARD_GRID_ID];

    return (
      <StickyContainer
        className={cx('dashboard', editMode && 'dashboard--editing')}
      >
        {topLevelTabs || !editMode ? ( // you cannot drop on/displace tabs if they already exist
          <DashboardHeader />
        ) : (
          <DragDroppable
            component={dashboardRoot}
            parentComponent={null}
            depth={DASHBOARD_ROOT_DEPTH}
            index={0}
            orientation="column"
            onDrop={handleComponentDrop}
            editMode
          >
            {({ dropIndicatorProps }) => (
              <div>
                <DashboardHeader />
                {dropIndicatorProps && <div {...dropIndicatorProps} />}
              </div>
            )}
          </DragDroppable>
        )}

        {topLevelTabs && (
          <Sticky topOffset={50}>
            {({ style }) => (
              <WithPopoverMenu
                shouldFocus={DashboardBuilder.shouldFocusTabs}
                menuItems={[
                  <IconButton
                    className="fa fa-level-down"
                    label="Collapse tab content"
                    onClick={deleteTopLevelTabs}
                  />,
                ]}
                editMode={editMode}
                style={{ zIndex: 1000, ...style }}
              >
                <DashboardComponent
                  id={topLevelTabs.id}
                  parentId={DASHBOARD_ROOT_ID}
                  depth={DASHBOARD_ROOT_DEPTH + 1}
                  index={0}
                  renderTabContent={false}
                  onChangeTab={this.handleChangeTab}
                />
              </WithPopoverMenu>
            )}
          </Sticky>
        )}

        <div className="dashboard-content">
          <div className="grid-container">
            <ParentSize>
              {({ width }) => (
                /*
                  We use a TabContainer irrespective of whether top-level tabs exist to maintain
                  a consistent React component tree. This avoids expensive mounts/unmounts of
                  the entire dashboard upon adding/removing top-level tabs, which would otherwise
                  happen because of React's diffing algorithm
                */
                <TabContainer
                  id={DASHBOARD_GRID_ID}
                  activeKey={tabIndex}
                  onSelect={this.handleChangeTab}
                  // these are important for performant loading of tabs. also, there is a
                  // react-bootstrap bug where mountOnEnter has no effect unless animation=true
                  animation
                  mountOnEnter
                  unmountOnExit={false}
                >
                  <TabContent>
                    {childIds.map((id, index) => (
                      // Matching the key of the first TabPane irrespective of topLevelTabs
                      // lets us keep the same React component tree when !!topLevelTabs changes.
                      // This avoids expensive mounts/unmounts of the entire dashboard.
                      <TabPane
                        key={index === 0 ? DASHBOARD_GRID_ID : id}
                        eventKey={index}
                      >
                        <DashboardGrid
                          gridComponent={dashboardLayout[id]}
                          depth={DASHBOARD_ROOT_DEPTH + 1}
                          width={width}
                        />
                      </TabPane>
                    ))}
                  </TabContent>
                </TabContainer>
              )}
            </ParentSize>
          </div>

          {this.props.editMode &&
            this.props.showBuilderPane && <BuilderComponentPane />}
        </div>
        <ToastPresenter />
      </StickyContainer>
    );
  }
}

DashboardBuilder.propTypes = propTypes;
DashboardBuilder.defaultProps = defaultProps;

export default DragDropContext(HTML5Backend)(DashboardBuilder);
