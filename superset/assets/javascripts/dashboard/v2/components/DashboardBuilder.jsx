import React from 'react';
import PropTypes from 'prop-types';
import HTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext } from 'react-dnd';

import BuilderComponentPane from './BuilderComponentPane';
import DashboardHeader from '../containers/DashboardHeader';
import DashboardGrid from './DashboardGrid';
import DeleteComponentButton from './DeleteComponentButton';
import DragDroppable from './dnd/DragDroppable';
import DashboardComponent from '../containers/DashboardComponent';
import WithPopoverMenu from './menu/WithPopoverMenu';

import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
} from '../util/constants';

const propTypes = {
  editMode: PropTypes.bool,

  // redux
  dashboard: PropTypes.object.isRequired,
  deleteTopLevelTabs: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
};

const defaultProps = {
  editMode: true,
};

class DashboardBuilder extends React.Component {
  static shouldFocusTabs(event) {
    // don't focus the tabs when we click on a tab
    return event.target.tagName === 'UL' || /icon-button/.test(event.target.className);
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
    const { handleComponentDrop, updateComponents, dashboard, deleteTopLevelTabs } = this.props;
    const dashboardRoot = dashboard[DASHBOARD_ROOT_ID];
    const rootChildId = dashboardRoot.children[0];
    const topLevelTabs = rootChildId !== DASHBOARD_GRID_ID && dashboard[rootChildId];

    const gridComponentId = topLevelTabs
      ? topLevelTabs.children[Math.min(topLevelTabs.children.length - 1, tabIndex)]
      : DASHBOARD_GRID_ID;

    const gridComponent = dashboard[gridComponentId];

    return (
      <div className="dashboard-v2">
        <DragDroppable
          component={dashboardRoot}
          parentComponent={null}
          index={0}
          orientation="column"
          onDrop={handleComponentDrop}
        >
          {({ dropIndicatorProps }) => (
            <div>
              <DashboardHeader />
              {dropIndicatorProps &&
                <div {...dropIndicatorProps} />}
            </div>
          )}
        </DragDroppable>

        {topLevelTabs &&
          <WithPopoverMenu
            shouldFocus={DashboardBuilder.shouldFocusTabs}
            menuItems={[<DeleteComponentButton onDelete={deleteTopLevelTabs} />]}
          >
            <DashboardComponent
              id={topLevelTabs.id}
              parentId={DASHBOARD_ROOT_ID}
              depth={0}
              index={0}
              renderTabContent={false}
              onChangeTab={this.handleChangeTab}
            />
          </WithPopoverMenu>}

        <div className="dashboard-builder">
          <DashboardGrid
            gridComponent={gridComponent}
            dashboard={dashboard}
            handleComponentDrop={handleComponentDrop}
            updateComponents={updateComponents}
          />
          <BuilderComponentPane />
        </div>
      </div>
    );
  }
}

DashboardBuilder.propTypes = propTypes;
DashboardBuilder.defaultProps = defaultProps;

export default DragDropContext(HTML5Backend)(DashboardBuilder);
