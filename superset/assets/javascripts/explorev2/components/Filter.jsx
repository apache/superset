const $ = window.$ = require('jquery');
import React, { PropTypes } from 'react';
import Select from 'react-select';
import { Button, Row, Col } from 'react-bootstrap';
import SelectField from './SelectField';

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
    this.opChoices = this.props.having ? ['==', '!=', '>', '<', '>=', '<=']
      : ['in', 'not in'];
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
  changeFilter(field, event) {
    let value = event;
    if (event && event.target) {
      value = event.target.value;
    }
    if (event && event.value) {
      value = event.value;
    }
    this.props.changeFilter(field, value);
    if (field === 'col' && value !== null && this.props.datasource.filter_select) {
      this.fetchFilterValues(value);
    }
  }
  removeFilter(filter) {
    this.props.removeFilter(filter);
  }
  renderFilterFormField(filter) {
    const datasource = this.props.datasource;
    if (datasource && datasource.filter_select) {
      if (!filter.choices) {
        this.fetchFilterValues(filter.col);
      }
    }
    if (this.props.having) {
      // druid having filter
      return (
        <input
          type="text"
          onChange={this.changeFilter.bind(this, 'val')}
          value={filter.value}
          className="form-control input-sm"
          placeholder="Filter value"
        />
      );
    }
    return (
      <SelectField
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
            {this.renderFilterFormField(filter)}
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
