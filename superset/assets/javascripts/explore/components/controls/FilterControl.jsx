import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'react-bootstrap';
import Filter from './Filter';
import { t } from '../../../locales';

const $ = window.$ = require('jquery');

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.array,
  datasource: PropTypes.object,
};

const defaultProps = {
  onChange: () => {},
  value: [],
};

export default class FilterControl extends React.Component {

  constructor(props) {
    super(props);
    const initialFilters = props.value.map(() => ({
      valuesLoading: false,
      valueChoices: [],
    }));
    this.state = {
      filters: initialFilters,
    };
  }

  componentDidMount() {
    this.state.filters.forEach((filter, index) => this.fetchFilterValues(index));
  }

  fetchFilterValues(index, column) {
    const datasource = this.props.datasource;
    const col = column || this.props.value[index].col;
    const having = this.props.name === 'having_filters';
    if (col && this.props.datasource && this.props.datasource.filter_select && !having) {
      this.setState((prevState) => {
        const newStateFilters = Object.assign([], prevState.filters);
        newStateFilters[index].valuesLoading = true;
        return { filters: newStateFilters };
      });
      $.ajax({
        type: 'GET',
        url: `/superset/filter/${datasource.type}/${datasource.id}/${col}/`,
        success: (data) => {
          this.setState((prevState) => {
            const newStateFilters = Object.assign([], prevState.filters);
            newStateFilters[index] = { valuesLoading: false, valueChoices: data };
            return { filters: newStateFilters };
          });
        },
      });
    }
  }

  addFilter() {
    const newFilters = Object.assign([], this.props.value);
    const col = this.props.datasource && this.props.datasource.filterable_cols.length > 0 ?
      this.props.datasource.filterable_cols[0][0] :
      null;
    newFilters.push({
      col,
      op: 'in',
      val: this.props.datasource.filter_select ? [] : '',
    });
    this.props.onChange(newFilters);
    const nextIndex = this.state.filters.length;
    this.setState((prevState) => {
      const newStateFilters = Object.assign([], prevState.filters);
      newStateFilters.push({ valuesLoading: false, valueChoices: [] });
      return { filters: newStateFilters };
    });
    this.fetchFilterValues(nextIndex, col);
  }

  changeFilter(index, control, value) {
    const newFilters = Object.assign([], this.props.value);
    const modifiedFilter = Object.assign({}, newFilters[index]);
    if (typeof control === 'string') {
      modifiedFilter[control] = value;
    } else {
      control.forEach((c, i) => {
        modifiedFilter[c] = value[i];
      });
    }
    // Clear selected values and refresh upon column change
    if (control === 'col') {
      if (modifiedFilter.val.constructor === Array) {
        modifiedFilter.val = [];
      } else if (typeof modifiedFilter.val === 'string') {
        modifiedFilter.val = '';
      }
      this.fetchFilterValues(index, value);
    }
    newFilters.splice(index, 1, modifiedFilter);
    this.props.onChange(newFilters);
  }

  removeFilter(index) {
    this.props.onChange(this.props.value.filter((f, i) => i !== index));
    this.setState((prevState) => {
      const newStateFilters = Object.assign([], prevState.filters);
      newStateFilters.splice(index, 1);
      return { filters: newStateFilters };
    });
  }

  render() {
    const filters = this.props.value.map((filter, i) => (
      <div key={i}>
        <Filter
          having={this.props.name === 'having_filters'}
          filter={filter}
          datasource={this.props.datasource}
          removeFilter={this.removeFilter.bind(this, i)}
          changeFilter={this.changeFilter.bind(this, i)}
          valuesLoading={this.state.filters[i].valuesLoading}
          valueChoices={this.state.filters[i].valueChoices}
        />
      </div>
    ));
    return (
      <div>
        {filters}
        <Row className="space-2">
          <Col md={2}>
            <Button
              id="add-button"
              bsSize="sm"
              onClick={this.addFilter.bind(this)}
            >
              <i className="fa fa-plus" /> &nbsp; {t('Add Filter')}
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

FilterControl.propTypes = propTypes;
FilterControl.defaultProps = defaultProps;
