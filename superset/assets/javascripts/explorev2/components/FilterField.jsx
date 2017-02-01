import React, { PropTypes } from 'react';
import { Button, Row, Col } from 'react-bootstrap';
import Filter from './Filter';

const propTypes = {
  name: PropTypes.string,
  choices: PropTypes.array,
  onChange: PropTypes.func,
  value: PropTypes.array,
  datasource: PropTypes.object,
};

const defaultProps = {
  choices: [],
  onChange: () => {},
  value: [],
};

export default class FilterField extends React.Component {
  addFilter() {
    const newFilters = Object.assign([], this.props.value);
    newFilters.push({
      col: null,
      op: 'in',
      val: this.props.datasource.filter_select ? [] : '',
    });
    this.props.onChange(newFilters);
  }
  changeFilter(index, field, value) {
    const newFilters = Object.assign([], this.props.value);
    const modifiedFilter = Object.assign({}, newFilters[index]);
    modifiedFilter[field] = value;
    newFilters.splice(index, 1, modifiedFilter);
    this.props.onChange(newFilters);
  }
  removeFilter(index) {
    this.props.onChange(this.props.value.filter((f, i) => i !== index));
  }
  render() {
    const filters = [];
    this.props.value.forEach((filter, i) => {
      const filterBox = (
        <div key={i}>
          <Filter
            having={this.props.name === 'having_filters'}
            filter={filter}
            choices={this.props.choices}
            datasource={this.props.datasource}
            removeFilter={this.removeFilter.bind(this, i)}
            changeFilter={this.changeFilter.bind(this, i)}
          />
        </div>
      );
      filters.push(filterBox);
    });
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

FilterField.propTypes = propTypes;
FilterField.defaultProps = defaultProps;
