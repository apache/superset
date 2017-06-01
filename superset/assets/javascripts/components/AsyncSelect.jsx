import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';

const $ = window.$ = require('jquery');

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  mutator: PropTypes.func.isRequired,
  onAsyncError: PropTypes.func,
  value: PropTypes.number,
  valueRenderer: PropTypes.func,
  placeholder: PropTypes.string,
  autoSelect: PropTypes.bool,
};

const defaultProps = {
  placeholder: 'Select ...',
  valueRenderer: o => (<div>{o.label}</div>),
  onAsyncError: () => {},
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

      if (!this.props.value && this.props.autoSelect && this.state.options.length) {
        this.onChange(this.state.options[0]);
      }
    })
    .fail(() => {
      this.props.onAsyncError();
    })
    .always(() => {
      this.setState({ isLoading: false });
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
