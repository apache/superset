const $ = window.$ = require('jquery');
import React, { PropTypes } from 'react';
import Select from 'react-select';
import { Button, Row, Col } from 'react-bootstrap';
import SelectControl from './SelectControl';

const arrayFilterOps = ['in', 'not in'];
const strFilterOps = ['==', '!=', '>', '<', '>=', '<=', 'regex'];

const propTypes = {
  choices: PropTypes.array,
  changeFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  filter: PropTypes.object.isRequired,
  datasource: PropTypes.object,
  having: PropTypes.bool,
};

const defaultProps = {
  having: false,
  changeFilter: () => {},
  removeFilter: () => {},
  choices: [],
  datasource: null,
};

export default class Filter extends React.Component {
  constructor(props) {
    super(props);
    const filterOps = props.datasource.type === 'table' ?
      ['in', 'not in'] : ['==', '!=', 'in', 'not in', 'regex'];
    this.opChoices = this.props.having ? ['==', '!=', '>', '<', '>=', '<=']
      : filterOps;
  }
  fetchFilterValues(col) {
    if (!this.props.datasource) {
      return;
    }
    const datasource = this.props.datasource;
    let choices = [];
    if (col) {
      $.ajax({
        type: 'GET',
        url: `/superset/filter/${datasource.type}/${datasource.id}/${col}/`,
        success: (data) => {
          choices = Object.keys(data).map((k) =>
            ([`'${data[k]}'`, `'${data[k]}'`]));
          this.props.changeFilter('choices', choices);
        },
      });
    }
  }
  switchFilterValue(prevFilter, nextOp) {
    const prevOp = prevFilter.op;
    let newVal = null;
    if (arrayFilterOps.indexOf(prevOp) !== -1
        && strFilterOps.indexOf(nextOp) !== -1) {
      // switch from array to string
      newVal = this.props.filter.val.length > 0 ? this.props.filter.val[0] : '';
    }
    if (strFilterOps.indexOf(prevOp) !== -1
        && arrayFilterOps.indexOf(nextOp) !== -1) {
      // switch from string to array
      newVal = this.props.filter.val === '' ? [] : [this.props.filter.val];
    }
    return newVal;
  }
  changeFilter(control, event) {
    let value = event;
    if (event && event.target) {
      value = event.target.value;
    }
    if (event && event.value) {
      value = event.value;
    }
    if (control === 'op') {
      const newVal = this.switchFilterValue(this.props.filter, value);
      if (newVal) {
        this.props.changeFilter(['op', 'val'], [value, newVal]);
      } else {
        this.props.changeFilter(control, value);
      }
    } else {
      this.props.changeFilter(control, value);
    }
    if (control === 'col' && value !== null && this.props.datasource.filter_select) {
      this.fetchFilterValues(value);
    }
  }
  removeFilter(filter) {
    this.props.removeFilter(filter);
  }
  renderFilterFormControl(filter) {
    const datasource = this.props.datasource;
    if (datasource && datasource.filter_select) {
      if (!filter.choices) {
        this.fetchFilterValues(filter.col);
      }
    }
    // switching filter value between array/string when needed
    if (strFilterOps.indexOf(filter.op) !== -1) {
      // druid having filter or regex/==/!= filters
      return (
        <input
          type="text"
          onChange={this.changeFilter.bind(this, 'val')}
          value={filter.val}
          className="form-control input-sm"
          placeholder="Filter value"
        />
      );
    }
    return (
      <SelectControl
        multi
        freeForm
        name="filter-value"
        value={filter.val}
        choices={filter.choices || []}
        onChange={this.changeFilter.bind(this, 'val')}
      />
    );
  }
  render() {
    const filter = this.props.filter;
    return (
      <div>
        <Row className="space-1">
          <Col md={12}>
            <Select
              id="select-col"
              placeholder="Select column"
              options={this.props.choices.map((c) => ({ value: c[0], label: c[1] }))}
              value={filter.col}
              onChange={this.changeFilter.bind(this, 'col')}
            />
          </Col>
        </Row>
        <Row className="space-1">
          <Col md={3}>
            <Select
              id="select-op"
              placeholder="Select operator"
              options={this.opChoices.map((o) => ({ value: o, label: o }))}
              value={filter.op}
              onChange={this.changeFilter.bind(this, 'op')}
            />
          </Col>
          <Col md={7}>
            {this.renderFilterFormControl(filter)}
          </Col>
          <Col md={2}>
            <Button
              id="remove-button"
              bsSize="small"
              onClick={this.removeFilter.bind(this)}
            >
              <i className="fa fa-minus" />
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

Filter.propTypes = propTypes;
Filter.defaultProps = defaultProps;
