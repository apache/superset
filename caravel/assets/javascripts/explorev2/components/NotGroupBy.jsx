import React from 'react';
import Select from 'react-select';
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

class NotGroupBy extends React.Component {
  changeColumns(columns) {
    this.props.actions.setNotGroupByColumns(columns);
  }
  changeOrderings(orderings) {
    this.props.actions.setOrderings(orderings);
  }
  render() {
    return (
      <div className="panel space-1">
        <div className="panel-header">Not GroupBy</div>
        <div className="panel-body">
          <div className="row">
            <h5 className="section-heading">Columns</h5>
            <Select
              multi
              name="select-column"
              placeholder="Select columns"
              options={this.props.columnOpts}
              value={this.props.columns}
              autosize={false}
              onChange={this.changeColumns.bind(this)}
            />
          </div>
          <div className="row">
            <h5 className="section-heading">Orderings</h5>
            <Select
              multi
              name="select-orderings"
              placeholder="Select orderings"
              options={this.props.orderingOpts}
              value={this.props.orderings}
              autosize={false}
              onChange={this.changeOrderings.bind(this)}
            />
          </div>
        </div>
      </div>
    );
  }
}

NotGroupBy.propTypes = propTypes;
NotGroupBy.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    columnOpts: state.columnOpts,
    columns: state.columns,
    orderingOpts: state.orderingOpts,
    orderings: state.orderings,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(NotGroupBy);
