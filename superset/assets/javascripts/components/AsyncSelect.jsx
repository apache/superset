const $ = window.$ = require('jquery');
import React from 'react';
import Select from 'react-select';

const propTypes = {
  dataEndpoint: React.PropTypes.string.isRequired,
  onChange: React.PropTypes.func.isRequired,
  mutator: React.PropTypes.func.isRequired,
  value: React.PropTypes.number,
  valueRenderer: React.PropTypes.func,
  placeholder: React.PropTypes.string,
};

const defaultProps = {
  placeholder: 'Select ...',
  valueRenderer: (o) => (<div>{o.label}</div>),
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
  fetchOptions() {
    this.setState({ isLoading: true });
    const mutator = this.props.mutator;
    $.get(this.props.dataEndpoint, (data) => {
      this.setState({ options: mutator ? mutator(data) : data, isLoading: false });
    });
  }
  onChange(opt) {
    this.props.onChange(opt);
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
