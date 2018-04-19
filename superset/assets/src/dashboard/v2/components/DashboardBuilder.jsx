import cx from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import HTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext } from 'react-dnd';

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
  handleComponentDrop: PropTypes.func.isRequired,
};

const defaultProps = {
  editMode: true,
};

class DashboardBuilder extends React.Component {
  static shouldFocusTabs(event, container) {
    // don't focus the tabs when we click on a tab
    return event.target.tagName === 'UL' || (
      /icon-button/.test(event.target.className) && container.contains(event.target)
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
    const { tabIndex } = this.state;
    const { handleComponentDrop, dashboardLayout, deleteTopLevelTabs, editMode } = this.props;
    const dashboardRoot = dashboardLayout[DASHBOARD_ROOT_ID];
    const rootChildId = dashboardRoot.children[0];
    const topLevelTabs = rootChildId !== DASHBOARD_GRID_ID && dashboardLayout[rootChildId];

    const gridComponentId = topLevelTabs
      ? topLevelTabs.children[Math.min(topLevelTabs.children.length - 1, tabIndex)]
      : DASHBOARD_GRID_ID;

    const gridComponent = dashboardLayout[gridComponentId];

    return (
      <div className={cx('dashboard-v2', editMode && 'dashboard-v2--editing')}>
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
          </DragDroppable>)}

        {topLevelTabs &&
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
          >
            <DashboardComponent
              id={topLevelTabs.id}
              parentId={DASHBOARD_ROOT_ID}
              depth={DASHBOARD_ROOT_DEPTH + 1}
              index={0}
              renderTabContent={false}
              onChangeTab={this.handleChangeTab}
            />
          </WithPopoverMenu>}

        <div className="dashboard-content">
          <DashboardGrid
            gridComponent={gridComponent}
            depth={DASHBOARD_ROOT_DEPTH + 1}
          />
          {editMode && <BuilderComponentPane />}
        </div>
        <ToastPresenter />
      </div>
    );
  }
}

DashboardBuilder.propTypes = propTypes;
DashboardBuilder.defaultProps = defaultProps;

export default DragDropContext(HTML5Backend)(DashboardBuilder);
