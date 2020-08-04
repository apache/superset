import { css, StyleSheet } from 'aphrodite';
import PropTypes from 'prop-types';
import React from 'react';

import Button from './Button';

const unit = 8;
const halfUnit = unit / 2;

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
    paddingRight: Number(unit),
  },

  buttons: {
    display: 'inherit',
  },

  spacer: {
    width: halfUnit,
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
    this.handleIncrementValue = this.handleIncrementValue.bind(this);
    this.handleDecrementValue = this.handleDecrementValue.bind(this);

    const { value, disableZero } = props;
    this.state = {
      value: disableZero && value === 0 ? 1 : value,
    };
  }

  componentWillReceiveProps(nextProps) {
    const { value } = this.state;
    const { value: nextValue } = nextProps;
    if (nextValue !== value) {
      this.setState({
        value: nextValue,
      });
    }
  }

  handleIncrementValue() {
    const { onChange, max, disableZero } = this.props;
    const { value } = this.state;
    if (value < max) {
      let nextValue = value + 1;
      if (nextValue === 0 && disableZero) nextValue += 1;
      this.setState({ value: nextValue });
      if (onChange) onChange(nextValue);
    }
  }

  handleDecrementValue() {
    const { onChange, min, disableZero } = this.props;
    const { value } = this.state;
    if (value > min) {
      let nextValue = value - 1;
      if (nextValue === 0 && disableZero) nextValue -= 1;
      this.setState({ value: nextValue });
      if (onChange) onChange(nextValue);
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
          <Button onClick={this.handleDecrementValue} disabled={value <= min} round small>
            -
          </Button>
          <div className={css(styles.spacer)} />
          <Button onClick={this.handleIncrementValue} disabled={value >= max} round small>
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
