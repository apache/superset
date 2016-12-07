import React from 'react';
// import { Tab, Row, Col, Nav, NavItem } from 'react-bootstrap';
import Select from 'react-select';
import { Button } from 'react-bootstrap';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  filterColumnOpts: React.PropTypes.array,
  prefix: React.PropTypes.string,
  filter: React.PropTypes.object.isRequired,
};

const defaultProps = {
  filterColumnOpts: [],
  prefix: 'flt',
};

export default class Filter extends React.Component {
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
  render() {
    return (
      <div>
        <div className="row space-1">
          <Select
            className="col-lg-12"
            multi={false}
            name="select-column"
            placeholder="Select column"
            options={this.props.filterColumnOpts.map((o) => ({ value: o, label: o }))}
            value={this.props.filter.col}
            autosize={false}
            onChange={this.changeCol.bind(this, this.props.filter)}
          />
        </div>
        <div className="row space-1">
          <Select
            className="col-lg-4"
            multi={false}
            name="select-op"
            placeholder="Select operator"
            options={this.state.opChoices.map((o) => ({ value: o, label: o }))}
            value={this.props.filter.op}
            autosize={false}
            onChange={this.changeOp.bind(this, this.props.filter)}
          />
          <div className="col-lg-6">
            <input
              type="text"
              onChange={this.changeValue.bind(this, this.props.filter)}
              value={this.props.filter.value}
              className="form-control input-sm"
              placeholder="Filter value"
            />
          </div>
          <div className="col-lg-2">
            <Button
              id="remove-button"
              bsSize="small"
              onClick={this.removeFilter.bind(this, this.props.filter)}
            >
              <i className="fa fa-minus" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

Filter.propTypes = propTypes;
Filter.defaultProps = defaultProps;
