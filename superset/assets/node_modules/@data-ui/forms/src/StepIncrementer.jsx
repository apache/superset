import { css, StyleSheet } from 'aphrodite';
import PropTypes from 'prop-types';
import React from 'react';

import Button from './Button';

const unit = 8;

const styles = StyleSheet.create({
  container: {
    fontSize: 14,
    padding: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  inline: {
    display: 'inline-block',
  },

  label: {
    fontWeight: 700,
    paddingRight: 1 * unit,
  },

  buttons: {
    display: 'inherit',
  },

  spacer: {
    width: 0.5 * unit,
  },
});

const propTypes = {
  min: PropTypes.number,
  max: PropTypes.number,
  inline: PropTypes.bool,
  formatValue: PropTypes.func,
  value: PropTypes.number,
  onChange: PropTypes.func,
  disableZero: PropTypes.bool,
  labelWidth: PropTypes.number,
};

const defaultProps = {
  min: -3,
  max: 3,
  value: 0,
  inline: true,
  onChange: () => {},
  formatValue: val => val,
  disableZero: false,
  labelWidth: null,
};

class StepIncrementer extends React.Component {
  constructor(props) {
    super(props);
    this.incrementValue = this.incrementValue.bind(this);
    this.decrementValue = this.decrementValue.bind(this);

    const { value, disableZero } = props;
    this.state = {
      value: disableZero && value === 0 ? 1 : value,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.state.value) {
      this.setState({
        value: nextProps.value,
      });
    }
  }

  incrementValue() {
    const { onChange, max, disableZero } = this.props;
    if (this.state.value < max) {
      let value = this.state.value + 1;
      if (value === 0 && disableZero) value += 1;
      this.setState({ value });
      if (onChange) onChange(value);
    }
  }

  decrementValue() {
    const { onChange, min, disableZero } = this.props;
    if (this.state.value > min) {
      let value = this.state.value - 1;
      if (value === 0 && disableZero) value -= 1;
      this.setState({ value });
      if (onChange) onChange(value);
    }
  }

  render() {
    const { min, max, formatValue, inline, labelWidth: width } = this.props;
    const { value } = this.state;

    const inner = (
      <div className={css(styles.container)}>
        <div className={css(styles.label)} style={width && { width }}>
          {formatValue(value)}
        </div>
        <div className={css(styles.buttons)}>
          <Button
            onClick={this.decrementValue}
            disabled={value <= min}
            round
            small
          >
            -
          </Button>
          <div className={css(styles.spacer)} />
          <Button
            onClick={this.incrementValue}
            disabled={value >= max}
            round
            small
          >
            +
          </Button>
        </div>
      </div>
    );

    return inline ? <div className={css(styles.inline)}>{inner}</div> : inner;
  }
}

StepIncrementer.propTypes = propTypes;
StepIncrementer.defaultProps = defaultProps;

export default StepIncrementer;
