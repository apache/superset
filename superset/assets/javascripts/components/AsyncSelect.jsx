import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';

const $ = window.$ = require('jquery');

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  mutator: PropTypes.func.isRequired,
  value: PropTypes.number,
  valueRenderer: PropTypes.func,
  placeholder: PropTypes.string,
};

const defaultProps = {
  placeholder: 'Select ...',
  valueRenderer: o => (<div>{o.label}</div>),
};

class AsyncSelect extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      options: [],
    };
  }
  componentDidMount() {
    this.fetchOptions();
  }
  onChange(opt) {
    this.props.onChange(opt);
  }
  fetchOptions() {
    this.setState({ isLoading: true });
    const mutator = this.props.mutator;
    $.get(this.props.dataEndpoint, (data) => {
      this.setState({ options: mutator ? mutator(data) : data, isLoading: false });
    });
  }
  render() {
    return (
      <div>
        <Select
          placeholder={this.props.placeholder}
          options={this.state.options}
          value={this.props.value}
          isLoading={this.state.isLoading}
          onChange={this.onChange.bind(this)}
          valueRenderer={this.props.valueRenderer}
        />
      </div>
    );
  }
}

AsyncSelect.propTypes = propTypes;
AsyncSelect.defaultProps = defaultProps;

export default AsyncSelect;
