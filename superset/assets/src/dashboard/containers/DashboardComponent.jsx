import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import ComponentLookup from '../components/gridComponents';
import getDetailedComponentWidth from '../util/getDetailedComponentWidth';
import { componentShape } from '../util/propShapes';
import { COLUMN_TYPE, ROW_TYPE } from '../util/componentTypes';

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

function mapStateToProps(
  { dashboardLayout: undoableLayout, dashboardState },
  ownProps,
) {
  const dashboardLayout = undoableLayout.present;
  const { id, parentId } = ownProps;
  const component = dashboardLayout[id];
  const props = {
    component,
    parentComponent: dashboardLayout[parentId],
    editMode: dashboardState.editMode,
  };

  // rows and columns need more data about their child dimensions
  // doing this allows us to not pass the entire component lookup to all Components
  const componentType = component.type;
  if (componentType === ROW_TYPE || componentType === COLUMN_TYPE) {
    const { occupiedWidth, minimumWidth } = getDetailedComponentWidth({
      id,
      components: dashboardLayout,
    });

    if (componentType === ROW_TYPE) props.occupiedColumnCount = occupiedWidth;
    if (componentType === COLUMN_TYPE) props.minColumnWidth = minimumWidth;
  }

  return props;
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      createComponent,
      deleteComponent,
      updateComponents,
      handleComponentDrop,
    },
    dispatch,
  );
}

class DashboardComponent extends React.PureComponent {
  render() {
    const { component } = this.props;
    const Component = ComponentLookup[component.type];
    return Component ? <Component {...this.props} /> : null;
  }
}

DashboardComponent.propTypes = propTypes;

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DashboardComponent);
