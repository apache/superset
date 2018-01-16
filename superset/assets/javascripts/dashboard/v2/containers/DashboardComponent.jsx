import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import ComponentLookup from '../components/gridComponents';
import countChildRowsAndColumns from '../util/countChildRowsAndColumns';
import { componentShape } from '../util/propShapes';
import { ROW_TYPE } from '../util/componentTypes';

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

function mapStateToProps({ dashboard = {} }, ownProps) {
  const { id, parentId } = ownProps;
  const props = {
    component: dashboard[id],
    parentComponent: dashboard[parentId],
  };

  // row is a special component that needs extra dims about its children
  // doing this allows us to not pass the entire component lookup to all Components
  if (props.component.type === ROW_TYPE) {
    const { rowCount, columnCount } = countChildRowsAndColumns({
      component: props.component,
      components: dashboard,
    });

    props.occupiedRowCount = rowCount;
    props.occupiedColumnCount = columnCount;
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
