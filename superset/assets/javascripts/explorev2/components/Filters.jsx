import React from 'react';
// import { Tab, Row, Col, Nav, NavItem } from 'react-bootstrap';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import shortid from 'shortid';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  filterColumnOpts: React.PropTypes.array,
  filters: React.PropTypes.array,
  prefix: React.PropTypes.string,
};

const defaultProps = {
  filterColumnOpts: [],
  filters: [],
  prefix: 'flt',
};

class Filters extends React.Component {
  constructor(props) {
    super(props);
    const opChoices = this.props.prefix === 'flt' ?
      ['in', 'not in'] : ['==', '!=', '>', '<', '>=', '<='];
    this.state = {
      opChoices,
    };
  }
  changeCol(filter, colOpt) {
    const val = (colOpt) ? colOpt.value : null;
    this.props.actions.changeFilter(filter, 'col', val);
  }
  changeOp(filter, opOpt) {
    const val = (opOpt) ? opOpt.value : null;
    this.props.actions.changeFilter(filter, 'op', val);
  }
  changeValue(filter, event) {
    this.props.actions.changeFilter(filter, 'value', event.target.value);
  }
  removeFilter(filter) {
    this.props.actions.removeFilter(filter);
  }
  addFilter() {
    this.props.actions.addFilter({
      id: shortid.generate(),
      prefix: this.props.prefix,
      col: null,
      op: null,
      value: null,
    });
  }
  render() {
    const filters = [];
    this.props.filters.forEach((filter) => {
      // only display filters with current prefix
      if (filter.prefix === this.props.prefix) {
        filters.push(
          <div>
            <div className="row space-1">
              <Select
                className="col-lg-12"
                multi={false}
                name="select-column"
                placeholder="Select column"
                options={this.props.filterColumnOpts.map((o) => ({ value: o, label: o }))}
                value={filter.col}
                autosize={false}
                onChange={this.changeCol.bind(this, filter)}
              />
            </div>
            <div className="row space-1">
              <Select
                className="col-lg-4"
                multi={false}
                name="select-op"
                placeholder="Select operator"
                options={this.state.opChoices.map((o) => ({ value: o, label: o }))}
                value={filter.op}
                autosize={false}
                onChange={this.changeOp.bind(this, filter)}
              />
              <div className="col-lg-6">
                <input
                  type="text"
                  onChange={this.changeValue.bind(this, filter)}
                  value={filter.value}
                  className="form-control input-sm"
                  placeholder="Filter value"
                />
              </div>
              <div className="col-lg-2">
                <Button
                  bsSize="small"
                  onClick={this.removeFilter.bind(this, filter)}
                >
                  <i className="fa fa-minus" />
                </Button>
              </div>
            </div>
          </div>
        );
      }
    });
    return (
      <div>
        {filters}
        <div className="row space-2">
          <div className="col-lg-2">
            <Button
              bsSize="sm"
              onClick={this.addFilter.bind(this)}
            >
              <i className="fa fa-plus" /> &nbsp; Add Filter
            </Button>
          </div>
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
    filters: state.viz.form_data.filters,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Filters);
