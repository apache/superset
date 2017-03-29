const $ = window.$ = require('jquery');
import React, { PropTypes } from 'react';
import Select from 'react-select';
import { Button, Row, Col } from 'react-bootstrap';
import SelectControl from './SelectControl';

const operatorsArr = [
  { val: 'in', type: 'array', useSelect: true, multi: true },
  { val: 'not in', type: 'array', useSelect: true, multi: true },
  { val: '==', type: 'string', useSelect: true, multi: false },
  { val: '!=', type: 'string', useSelect: true, multi: false },
  { val: '>=', type: 'string' },
  { val: '<=', type: 'string' },
  { val: '>', type: 'string' },
  { val: '<', type: 'string' },
  { val: 'regex', type: 'string', datasourceTypes: ['druid'] },
  { val: 'LIKE', type: 'string', datasourceTypes: ['table'] },
];
const operators = {};
operatorsArr.forEach(op => {
  operators[op.val] = op;
});

const propTypes = {
  changeFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  filter: PropTypes.object.isRequired,
  datasource: PropTypes.object,
};

const defaultProps = {
  changeFilter: () => {},
  removeFilter: () => {},
  datasource: null,
};

export default class Filter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      valuesLoading: false,
    };
  }
  componentDidMount() {
    this.fetchFilterValues(this.props.filter.col);
  }
  fetchFilterValues(col) {
    const datasource = this.props.datasource;
    if (col && this.props.datasource && this.props.datasource.filter_select) {
      this.setState({ valuesLoading: true });
      $.ajax({
        type: 'GET',
        url: `/superset/filter/${datasource.type}/${datasource.id}/${col}/`,
        success: (data) => {
          this.setState({ valuesLoading: false, valueChoices: data });
        },
      });
    }
  }
  switchFilterValue(prevOp, nextOp) {
    if (operators[prevOp].type !== operators[nextOp].type) {
      const val = this.props.filter.value;
      let newVal;
      // switch from array to string
      if (operators[nextOp].type === 'string' && val && val.length > 0) {
        newVal = val[0];
      } else if (operators[nextOp].type === 'string' && val) {
        newVal = [val];
      }
      this.props.changeFilter('val', newVal);
    }
  }
  changeText(event) {
    this.props.changeFilter('val', event.target.value);
  }
  changeSelect(value) {
    this.props.changeFilter('val', value);
  }
  changeColumn(event) {
    this.props.changeFilter('col', event.value);
    this.fetchFilterValues(event.value);
  }
  changeOp(event) {
    this.switchFilterValue(this.props.filter.op, event.value);
    this.props.changeFilter('op', event.value);
  }
  removeFilter(filter) {
    this.props.removeFilter(filter);
  }
  renderFilterFormControl(filter) {
    const operator = operators[filter.op];
    if (operator.useSelect) {
      return (
        <SelectControl
          multi={operator.multi}
          freeForm
          name="filter-value"
          value={filter.val}
          isLoading={this.state.valuesLoading}
          choices={this.state.valueChoices}
          onChange={this.changeSelect.bind(this)}
        />
      );
    }
    return (
      <input
        type="text"
        onChange={this.changeText.bind(this)}
        value={filter.val}
        className="form-control input-sm"
        placeholder="Filter value"
      />
    );
  }
  render() {
    const datasource = this.props.datasource;
    const filter = this.props.filter;
    const opsChoices = operatorsArr
    .filter(o => !o.datasourceTypes || o.datasourceTypes.indexOf(datasource.type) >= 0)
    .map(o => ({ value: o.val, label: o.val }));
    const colChoices = datasource ?
      datasource.filterable_cols.map(c => ({ value: c[0], label: c[1] })) :
      null;
    return (
      <div>
        <Row className="space-1">
          <Col md={12}>
            <Select
              id="select-col"
              placeholder="Select column"
              clearable={false}
              options={colChoices}
              value={filter.col}
              onChange={this.changeColumn.bind(this)}
            />
          </Col>
        </Row>
        <Row className="space-1">
          <Col md={3}>
            <Select
              id="select-op"
              placeholder="Select operator"
              options={opsChoices}
              clearable={false}
              value={filter.op}
              onChange={this.changeOp.bind(this)}
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
