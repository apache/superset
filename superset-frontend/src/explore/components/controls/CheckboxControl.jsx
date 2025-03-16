// DODO was here
import { Component } from 'react';
import PropTypes from 'prop-types';
import { styled, css } from '@superset-ui/core';
import ControlHeader from '../ControlHeader';
import Checkbox from '../../../components/Checkbox';

const propTypes = {
  value: PropTypes.bool,
  label: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  value: false,
  onChange: () => {},
};

const CheckBoxControlWrapper = styled.div`
  ${({ theme, disabled }) => css`
    .ControlHeader label {
      // color: ${theme.colors.grayscale.dark1};
      color: ${disabled
        ? '#8c8c8c'
        : theme.colors.grayscale.dark1}; // DODO changed 44211792
    }
    span[role='checkbox'] {
      padding-right: ${theme.gridUnit * 2}px;
    }
  `}
`;

export default class CheckboxControl extends Component {
  onChange() {
    // DODO changed 44211792
    if (!this.props.disabled) {
      this.props.onChange(!this.props.value);
    }
  }

  renderCheckbox() {
    return (
      <Checkbox
        onChange={this.onChange.bind(this)}
        checked={!!this.props.value}
        disabled={this.props.disabled} // DODO added 44211792
      />
    );
  }

  render() {
    if (this.props.label) {
      return (
        // DODO changed 44211792
        <CheckBoxControlWrapper disabled={this.props.disabled}>
          <ControlHeader
            {...this.props}
            leftNode={this.renderCheckbox()}
            onClick={this.onChange.bind(this)}
          />
        </CheckBoxControlWrapper>
      );
    }
    return this.renderCheckbox();
  }
}
CheckboxControl.propTypes = propTypes;
CheckboxControl.defaultProps = defaultProps;
