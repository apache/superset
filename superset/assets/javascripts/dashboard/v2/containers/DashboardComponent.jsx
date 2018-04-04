import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import ComponentLookup from '../components/gridComponents';
import getTotalChildWidth from '../util/getChildWidth';
import { componentShape } from '../util/propShapes';
import { CHART_TYPE, COLUMN_TYPE, ROW_TYPE } from '../util/componentTypes';
import { GRID_MIN_COLUMN_COUNT } from '../util/constants';

import {
  createComponent,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
} from '../actions/dashboardLayout';

const propTypes = {
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  createComponent: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
};

function mapStateToProps({ dashboardLayout: undoableLayout, dashboard }, ownProps) {
  const dashboardLayout = undoableLayout.present;
  const { id, parentId, cells } = ownProps;
  const component = dashboardLayout[id];
  const props = {
    component,
    parentComponent: dashboardLayout[parentId],
    editMode: dashboard.editMode,
  };

  // rows and columns need more data about their child dimensions
  // doing this allows us to not pass the entire component lookup to all Components
  if (props.component.type === ROW_TYPE) {
    props.occupiedColumnCount = getTotalChildWidth({ id, components: dashboardLayout });
  } else if (props.component.type === COLUMN_TYPE) {
    props.minColumnWidth = GRID_MIN_COLUMN_COUNT;

    component.children.forEach((childId) => {
      // rows don't have widths, so find the width of its children
      if (dashboardLayout[childId].type === ROW_TYPE) {
        props.minColumnWidth = Math.max(
          props.minColumnWidth,
          getTotalChildWidth({ id: childId, components: dashboardLayout }),
        );
      }
    });
  } else if (props.component.type === CHART_TYPE) {
    const sliceId = props.component.meta && props.component.meta.sliceId;
    if (sliceId) {
      props.chart = cells[sliceId];
    }
  }

  return props;
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    createComponent,
    deleteComponent,
    updateComponents,
    handleComponentDrop,
  }, dispatch);
}

class DashboardComponent extends React.PureComponent {
  render() {
    const { component } = this.props;
    const Component = ComponentLookup[component.type];
    return Component ? <Component {...this.props} /> : null;
  }
}

DashboardComponent.propTypes = propTypes;

export default connect(mapStateToProps, mapDispatchToProps)(DashboardComponent);
