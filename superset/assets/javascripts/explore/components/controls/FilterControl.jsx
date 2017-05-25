import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'react-bootstrap';
import Filter from './Filter';

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
    newFilters.splice(index, 1, modifiedFilter);
    this.props.onChange(newFilters);
  }
  removeFilter(index) {
    this.props.onChange(this.props.value.filter((f, i) => i !== index));
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
              <i className="fa fa-plus" /> &nbsp; Add Filter
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

FilterControl.propTypes = propTypes;
FilterControl.defaultProps = defaultProps;
