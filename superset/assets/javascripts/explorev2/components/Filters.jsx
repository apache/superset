import React from 'react';
// import { Tab, Row, Col, Nav, NavItem } from 'react-bootstrap';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import shortid from 'shortid';

const propTypes = {
  actions: React.PropTypes.object,
  filterColumnOpts: React.PropTypes.array,
  filters: React.PropTypes.array,
};

const defaultProps = {
  filterColumnOpts: [],
  filters: [],
};

class Filters extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      opOpts: ['in', 'not in'],
    };
  }
  changeField(filter, fieldOpt) {
    const val = (fieldOpt) ? fieldOpt.value : null;
    this.props.actions.changeFilterField(filter, val);
  }
  changeOp(filter, opOpt) {
    const val = (opOpt) ? opOpt.value : null;
    this.props.actions.changeFilterOp(filter, val);
  }
  changeValue(filter, value) {
    this.props.actions.changeFilterValue(filter, value);
  }
  removeFilter(filter) {
    this.props.actions.removeFilter(filter);
  }
  addFilter() {
    this.props.actions.addFilter({
      id: shortid.generate(),
      field: null,
      op: null,
      value: null,
    });
  }
  render() {
    const filters = this.props.filters.map((filter) => (
      <div>
        <Select
          className="row"
          multi={false}
          name="select-column"
          placeholder="Select column"
          options={this.props.filterColumnOpts}
          value={filter.field}
          autosize={false}
          onChange={this.changeField.bind(this, filter)}
        />
        <div className="row">
          <Select
            className="col-sm-3"
            multi={false}
            name="select-op"
            placeholder="Select operator"
            options={this.state.opOpts.map((o) => ({ value: o, label: o }))}
            value={filter.op}
            autosize={false}
            onChange={this.changeOp.bind(this, filter)}
          />
          <div className="col-sm-6">
            <input
              type="text"
              onChange={this.changeValue.bind(this, filter)}
              className="form-control input-sm"
              placeholder="Filter value"
            />
          </div>
          <div className="col-sm-3">
            <Button
              bsStyle="primary"
              onClick={this.removeFilter.bind(this, filter)}
            >
              <i className="fa fa-minus" />
            </Button>
          </div>
        </div>
      </div>
      )
    );
    return (
      <div className="panel space-1">
        <div className="panel-header">Filters</div>
        <div className="panel-body">
          {filters}
          <Button
            bsStyle="primary"
            onClick={this.addFilter.bind(this)}
          >
            <i className="fa fa-plus" />Add Filter
          </Button>
        </div>
      </div>
    );
  }
}

Filters.propTypes = propTypes;
Filters.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    filterColumnOpts: state.filterColumnOpts,
    filters: state.filters,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Filters);
