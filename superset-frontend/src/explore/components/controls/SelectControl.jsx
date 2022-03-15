/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { css, isEqualArray, t } from '@superset-ui/core';
import Select from 'src/components/Select/Select';
import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  ariaLabel: PropTypes.string,
  autoFocus: PropTypes.bool,
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  disabled: PropTypes.bool,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  multi: PropTypes.bool,
  isMulti: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.array,
  ]),
  default: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.array,
  ]),
  showHeader: PropTypes.bool,
  optionRenderer: PropTypes.func,
  valueKey: PropTypes.string,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  filterOption: PropTypes.func,

  // ControlHeader props
  label: PropTypes.string,
  renderTrigger: PropTypes.bool,
  validationErrors: PropTypes.array,
  rightNode: PropTypes.node,
  leftNode: PropTypes.node,
  onClick: PropTypes.func,
  hovered: PropTypes.bool,
  tooltipOnClick: PropTypes.func,
  warning: PropTypes.string,
  danger: PropTypes.string,
};

const defaultProps = {
  autoFocus: false,
  choices: [],
  clearable: true,
  description: null,
  disabled: false,
  freeForm: false,
  isLoading: false,
  label: null,
  multi: false,
  onChange: () => {},
  onFocus: () => {},
  showHeader: true,
  valueKey: 'value',
};

export default class SelectControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      options: this.getOptions(props),
    };
    this.onChange = this.onChange.bind(this);
    this.handleFilterOptions = this.handleFilterOptions.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (
      !isEqualArray(nextProps.choices, this.props.choices) ||
      !isEqualArray(nextProps.options, this.props.options)
    ) {
      const options = this.getOptions(nextProps);
      this.setState({ options });
    }
  }

  // Beware: This is acting like an on-click instead of an on-change
  // (firing every time user chooses vs firing only if a new option is chosen).
  onChange(val) {
    // will eventually call `exploreReducer`: SET_FIELD_VALUE
    const { valueKey } = this.props;
    let onChangeVal = val;

    if (Array.isArray(val)) {
      const values = val.map(v =>
        v?.[valueKey] !== undefined ? v[valueKey] : v,
      );
      onChangeVal = values;
    }
    if (typeof val === 'object' && val?.[valueKey] !== undefined) {
      onChangeVal = val[valueKey];
    }
    this.props.onChange(onChangeVal, []);
  }

  getOptions(props) {
    const { choices, optionRenderer, valueKey } = props;
    let options = [];
    if (props.options) {
      options = props.options.map(o => ({
        ...o,
        value: o[valueKey],
        label: o.label || o[valueKey],
        customLabel: optionRenderer ? optionRenderer(o) : undefined,
      }));
    } else if (choices) {
      // Accepts different formats of input
      options = choices.map(c => {
        if (Array.isArray(c)) {
          const [value, label] = c.length > 1 ? c : [c[0], c[0]];
          return {
            value,
            label,
          };
        }
        if (Object.is(c)) {
          return {
            ...c,
            value: c[valueKey],
            label: c.label || c[valueKey],
          };
        }
        return { value: c, label: c };
      });
    }
    return options;
  }

  handleFilterOptions(text, option) {
    const { filterOption } = this.props;
    return filterOption({ data: option }, text);
  }

  render() {
    const {
      ariaLabel,
      autoFocus,
      clearable,
      disabled,
      filterOption,
      freeForm,
      isLoading,
      isMulti,
      label,
      multi,
      name,
      placeholder,
      onFocus,
      optionRenderer,
      showHeader,
      value,
      // ControlHeader props
      description,
      renderTrigger,
      rightNode,
      leftNode,
      validationErrors,
      onClick,
      hovered,
      tooltipOnClick,
      warning,
      danger,
    } = this.props;

    const headerProps = {
      name,
      label,
      description,
      renderTrigger,
      rightNode,
      leftNode,
      validationErrors,
      onClick,
      hovered,
      tooltipOnClick,
      warning,
      danger,
    };

    const getValue = () => {
      const currentValue =
        value ||
        (this.props.default !== undefined ? this.props.default : undefined);

      // safety check - the value is intended to be undefined but null was used
      if (
        currentValue === null &&
        !this.state.options.find(o => o.value === null)
      ) {
        return undefined;
      }
      return currentValue;
    };

    const selectProps = {
      allowNewOptions: freeForm,
      autoFocus,
      ariaLabel:
        ariaLabel || (typeof label === 'string' ? label : t('Select ...')),
      allowClear: clearable,
      disabled,
      filterOption:
        filterOption && typeof filterOption === 'function'
          ? this.handleFilterOptions
          : true,
      header: showHeader && <ControlHeader {...headerProps} />,
      loading: isLoading,
      mode: isMulti || multi ? 'multiple' : 'single',
      name: `select-${name}`,
      onChange: this.onChange,
      onFocus,
      optionRenderer,
      options: this.state.options,
      placeholder,
      sortComparator: this.props.sortComparator,
      value: getValue(),
    };

    return (
      <div
        css={theme => css`
          .type-label {
            margin-right: ${theme.gridUnit * 2}px;
          }
          .Select__multi-value__label > span,
          .Select__option > span,
          .Select__single-value > span {
            display: flex;
            align-items: center;
          }
        `}
      >
        <Select {...selectProps} />
      </div>
    );
  }
}

SelectControl.propTypes = propTypes;
SelectControl.defaultProps = defaultProps;
