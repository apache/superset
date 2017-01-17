const $ = window.$ = require('jquery');
import React, { PropTypes } from 'react';
import Select from 'react-select';
import { connect } from 'react-redux';
import shortid from 'shortid';
import { Button } from 'react-bootstrap';
import SelectField from './SelectField';

const propTypes = {
  prefix: PropTypes.string,
  choices: PropTypes.array,
  onChange: PropTypes.func,
  value: PropTypes.array,
  datasource: PropTypes.Object,
  renderFilterSelect: PropTypes.bool,
  datasource_type: PropTypes.string.isRequired,
};

const defaultProps = {
  prefix: 'flt',
  choices: [],
  onChange: () => {},
  value: [],
  renderFilterSelect: false,
};

class FilterField extends React.Component {
  constructor(props) {
    super(props);
    const opChoices = this.props.prefix === 'flt' ?
      ['in', 'not in'] : ['==', '!=', '>', '<', '>=', '<='];
    this.state = {
      opChoices,
    };
  }
  addFilter() {
    const newFilters = this.props.value;
    newFilters.push({
      id: shortid.generate(),
      prefix: this.props.prefix,
      col: null,
      op: 'in',
      value: this.props.renderFilterSelect ? [] : '',
    });
    this.props.onChange(newFilters);
  }
  removeFilter(id) {
    const newFilters = [];
    this.props.value.forEach((f) => {
      if (f.id !== id) {
        newFilters.push(f);
      }
    });
    this.props.onChange(newFilters);
  }
  changeInArray(id, field, value) {
    const newFilters = [];
    this.props.value.forEach((f) => {
      if (f.id !== id) {
        newFilters.push(f);
      } else {
        const modifiedFilter = Object.assign({}, f);
        modifiedFilter[field] = value;
        newFilters.push(modifiedFilter);
      }
    });
    this.props.onChange(newFilters);
  }
  changeFilter(id, field, event) {
    let value = event;
    if (event && event.target) {
      value = event.target.value;
    }
    if (event && event.value) {
      value = event.value;
    }
    this.changeInArray(id, field, value);
    if (field === 'col' && value !== null && this.props.renderFilterSelect) {
      this.fetchFilterValues(id, value);
    }
  }
  fetchFilterValues(id, col) {
    if (!this.props.datasource) {
      return;
    }
    const datasourceType = this.props.datasource_type;
    const datasource = this.props.datasource;
    let choices = [];
    if (col) {
      $.ajax({
        type: 'GET',
        url: `/superset/filter/${datasourceType}/${datasource.id}/${col}/`,
        success: (data) => {
          choices = Object.keys(data).map((k) =>
            ([`'${data[k]}'`, `'${data[k]}'`]));
          this.changeInArray(id, 'choices', choices);
        },
      });
    }
  }
  prepareFilter(filter) {
    return (
      <div>
        <div className="row space-1">
          <Select
            id="select-col"
            className="col-lg-12"
            placeholder="Select column"
            options={this.props.choices.map((c) => ({ value: c[0], label: c[1] }))}
            value={filter.col}
            onChange={this.changeFilter.bind(this, filter.id, 'col')}
          />
        </div>
        <div className="row space-1">
          <Select
            id="select-op"
            className="col-lg-4"
            placeholder="Select operator"
            options={this.state.opChoices.map((o) => ({ value: o, label: o }))}
            value={filter.op}
            onChange={this.changeFilter.bind(this, filter.id, 'op')}
          />
          <div className="col-lg-6">
            {this.renderFilterFormField(filter)}
          </div>
          <div className="col-lg-2">
            <Button
              id="remove-button"
              bsSize="small"
              onClick={this.removeFilter.bind(this, filter.id)}
            >
              <i className="fa fa-minus" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
  renderFilterFormField(filter) {
    if (this.props.renderFilterSelect) {
      if (!filter.choices) {
        this.fetchFilterValues(filter.id, filter.col);
      }
      return (
        <SelectField
          multi
          freeForm
          name="filter-value"
          value={filter.value}
          choices={filter.choices}
          onChange={this.changeFilter.bind(this, filter.id, 'value')}
        />
      );
    }
    return (
      <input
        type="text"
        onChange={this.changeFilter.bind(this, filter.id, 'value')}
        value={filter.value}
        className="form-control input-sm"
        placeholder="Filter value"
      />
    );
  }
  render() {
    const filters = [];
    let i = 0;
    this.props.value.forEach((filter) => {
      // only display filters with current prefix
      i++;
      if (filter.prefix === this.props.prefix) {
        const filterBox = (
          <div key={i}>
           {this.prepareFilter(filter)}
          </div>
        );
        filters.push(filterBox);
      }
    });
    return (
      <div>
        {filters}
        <div className="row space-2">
          <div className="col-lg-2">
            <Button
              id="add-button"
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

FilterField.propTypes = propTypes;
FilterField.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    datasource_type: state.datasource_type,
    datasource: state.datasource,
    renderFilterSelect: state.filter_select,
  };
}

export { FilterField };
export default connect(mapStateToProps, () => ({}))(FilterField);
