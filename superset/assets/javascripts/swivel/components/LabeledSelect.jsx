import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Label } from 'react-bootstrap';
import Select from 'react-select';


const style = {
  marginBottom: '1.5rem',
};

const propTypes = {
  title: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.object).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onInputKeyDown: PropTypes.func.isRequired,
};

export default class LabeledSelect extends PureComponent {
  constructor(props) {
    super(props);
    this.state = { value: props.value };
    this.onChange = this.onChange.bind(this);
  }

    // This detects if the local state will get changed from an outside event
    // which allows making async calls on onChange while keeping
    // the history intact.
  componentWillUpdate(nextProps, nextState) {
    if (nextProps.value !== this.props.value) {
      const { title, value } = nextProps;
      if (value !== nextState.value) {
        this.onChange({ title, value });
      }
    }
  }

  onChange(ds) {
    this.setState({ value: ds.value });
    this.props.onChange(ds);
  }

  render() {
    const { title, options, value, onInputKeyDown } = this.props;
    return (
      <div style={{ ...style }}>
        <Label>{title}</Label>
        <Select
          options={options}
          value={value}
          onChange={this.onChange}
          onInputKeyDown={onInputKeyDown}
          clearable={false}
        />
      </div>
    );
  }
}

LabeledSelect.defaultProps = {
  onChange: () => {},
  onInputKeyDown: () => {},
};

LabeledSelect.propTypes = propTypes;
