// DODO was here
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { bootstrapData } from 'src/preamble'; // DODO added 44120742
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
  setActiveTab,
  setFullSizeChartId,
} from 'src/dashboard/actions/dashboardState';

const locale = bootstrapData?.common?.locale || 'en'; // DODO added 44120742

const propTypes = {
  id: PropTypes.string,
  parentId: PropTypes.string,
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

  // DODO extended
  locale: PropTypes.string, // DODO added 44120742
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
    dashboardInfo,
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
      setActiveTab,
      logEvent,
    },
    dispatch,
  );
}

class DashboardComponent extends PureComponent {
  render() {
    const { component } = this.props;
    const Component = component ? componentLookup[component.type] : null;
    return Component ? <Component locale={locale} {...this.props} /> : null;
  }
}

DashboardComponent.propTypes = propTypes;
DashboardComponent.defaultProps = defaultProps;

export default connect(mapStateToProps, mapDispatchToProps)(DashboardComponent);
