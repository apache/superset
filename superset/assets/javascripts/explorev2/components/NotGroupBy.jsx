import React from 'react';
import SelectArray from './SelectArray';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';

const propTypes = {
  actions: React.PropTypes.object,
  columnOpts: React.PropTypes.array,
  columns: React.PropTypes.array,
  orderingOpts: React.PropTypes.array,
  orderings: React.PropTypes.array,
};

const defaultProps = {
  columnOpts: [],
  columns: [],
  orderingOpts: [],
  orderings: [],
};

const NotGroupBy = (props) => {
  const selects = [
    {
      key: 'columns',
      title: 'Columns',
      options: props.columnOpts,
      value: props.columns,
      multi: true,
      width: '12',
    },
    {
      key: 'orderings',
      title: 'Orderings',
      options: props.orderingOpts,
      value: props.orderings,
      multi: true,
      width: '12',
    }];
  return (
    <div className="panel">
      <div className="panel-header">Not GroupBy</div>
      <div className="panel-body">
        <SelectArray selectArray={selects} />
      </div>
    </div>
  );
};

NotGroupBy.propTypes = propTypes;
NotGroupBy.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    columnOpts: state.columnOpts,
    columns: state.viz.formData.columns,
    orderingOpts: state.orderingOpts,
    orderings: state.viz.formData.orderings,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(NotGroupBy);
