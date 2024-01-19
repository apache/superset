// DODO was here
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { logEvent } from 'src/logger/actions';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { componentLookup } from 'src/dashboard/components/gridComponents';
import getDetailedComponentWidth from 'src/dashboard/util/getDetailedComponentWidth';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { componentShape } from 'src/dashboard/util/propShapes';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  createComponent,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
} from 'src/dashboard/actions/dashboardLayout';
import {
  setDirectPathToChild,
  setActiveTabs,
  setFullSizeChartId,
} from 'src/dashboard/actions/dashboardState';

const propTypes = {
  id: PropTypes.string,
  parentId: PropTypes.string,
  // DODO addded
  userLanguage: PropTypes.string,
  depth: PropTypes.number,
  index: PropTypes.number,
  renderHoverMenu: PropTypes.bool,
  renderTabContent: PropTypes.bool,
  onChangeTab: PropTypes.func,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  createComponent: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  logEvent: PropTypes.func.isRequired,
  directPathToChild: PropTypes.arrayOf(PropTypes.string),
  directPathLastUpdated: PropTypes.number,
  dashboardId: PropTypes.number.isRequired,
  isComponentVisible: PropTypes.bool,
};

const defaultProps = {
  isComponentVisible: true,
};

function mapStateToProps(
  { dashboardLayout: undoableLayout, dashboardState, dashboardInfo },
  ownProps,
) {
  const dashboardLayout = undoableLayout.present;
  const { id, parentId } = ownProps;
  const component = dashboardLayout[id];
  const props = {
    component,
    getComponentById: id => dashboardLayout[id],
    parentComponent: dashboardLayout[parentId],
    editMode: dashboardState.editMode,
    filters: getActiveFilters(),
    dashboardId: dashboardInfo.id,
    fullSizeChartId: dashboardState.fullSizeChartId,
  };

  // rows and columns need more data about their child dimensions
  // doing this allows us to not pass the entire component lookup to all Components
  if (component) {
    const componentType = component.type;
    if (componentType === ROW_TYPE || componentType === COLUMN_TYPE) {
      const { occupiedWidth, minimumWidth } = getDetailedComponentWidth({
        id,
        components: dashboardLayout,
      });

      if (componentType === ROW_TYPE) props.occupiedColumnCount = occupiedWidth;
      if (componentType === COLUMN_TYPE) props.minColumnWidth = minimumWidth;
    }
  }

  return props;
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      addDangerToast,
      createComponent,
      deleteComponent,
      updateComponents,
      handleComponentDrop,
      setDirectPathToChild,
      setFullSizeChartId,
      setActiveTabs,
      logEvent,
    },
    dispatch,
  );
}

class DashboardComponent extends React.PureComponent {
  render() {
    const { component } = this.props;
    const Component = component ? componentLookup[component.type] : null;
    return Component ? <Component {...this.props} /> : null;
  }
}

DashboardComponent.propTypes = propTypes;
DashboardComponent.defaultProps = defaultProps;

export default connect(mapStateToProps, mapDispatchToProps)(DashboardComponent);
