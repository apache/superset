import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import ComponentLookup from '../components/gridComponents';
import getTotalChildWidth from '../util/getChildWidth';
import { componentShape } from '../util/propShapes';
import { COLUMN_TYPE, ROW_TYPE } from '../util/componentTypes';
import { GRID_MIN_COLUMN_COUNT } from '../util/constants';

import {
  createComponent,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
} from '../actions';

const propTypes = {
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  createComponent: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
};

function mapStateToProps({ dashboard: undoableDashboard }, ownProps) {
  const components = undoableDashboard.present;
  const { id, parentId } = ownProps;
  const component = components[id];
  const props = {
    component,
    parentComponent: components[parentId],
  };

  // rows and columns need more data about their child dimensions
  // doing this allows us to not pass the entire component lookup to all Components
  if (props.component.type === ROW_TYPE) {
    props.occupiedColumnCount = getTotalChildWidth({ id, components });
  } else if (props.component.type === COLUMN_TYPE) {
    props.minColumnWidth = GRID_MIN_COLUMN_COUNT;

    component.children.forEach((childId) => {
      // rows don't have widths, so find the width of its children
      if (components[childId].type === ROW_TYPE) {
        props.minColumnWidth = Math.max(
          props.minColumnWidth,
          getTotalChildWidth({ id: childId, components }),
        );
      }
    });
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
