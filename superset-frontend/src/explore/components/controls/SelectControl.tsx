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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { css, isEqualArray, t } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  ariaLabel: PropTypes.string,
  autoFocus: PropTypes.bool,
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  disabled: PropTypes.bool,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  mode: PropTypes.string,
  multi: PropTypes.bool,
  isMulti: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  onSelect: PropTypes.func,
  onDeselect: PropTypes.func,
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
  tokenSeparators: PropTypes.arrayOf(PropTypes.string),
  notFoundContent: PropTypes.object,

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

export const innerGetOptions = (props: $TSFixMe) => {
  const { choices, optionRenderer, valueKey } = props;
  let options = [];
  if (props.options) {
    options = props.options.map((o: $TSFixMe) => ({
      ...o,
      value: o[valueKey],
      label: optionRenderer ? optionRenderer(o) : o.label || o[valueKey],
    }));
  } else if (choices) {
    // Accepts different formats of input
    options = choices.map((c: $TSFixMe) => {
      if (Array.isArray(c)) {
        const [value, label] = c.length > 1 ? c : [c[0], c[0]];
        return {
          value,
          label,
        };
      }
      // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
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
};

export default class SelectControl extends PureComponent {
  constructor(props: $TSFixMe) {
    super(props);
    this.state = {
      options: this.getOptions(props),
    };
    this.onChange = this.onChange.bind(this);
    this.handleFilterOptions = this.handleFilterOptions.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps: $TSFixMe) {
    if (
      // @ts-expect-error TS(2339): Property 'choices' does not exist on type 'Readonl... Remove this comment to see the full error message
      !isEqualArray(nextProps.choices, this.props.choices) ||
      // @ts-expect-error TS(2339): Property 'options' does not exist on type 'Readonl... Remove this comment to see the full error message
      !isEqualArray(nextProps.options, this.props.options)
    ) {
      const options = this.getOptions(nextProps);
      this.setState({ options });
    }
  }

  // Beware: This is acting like an on-click instead of an on-change
  // (firing every time user chooses vs firing only if a new option is chosen).
  onChange(val: $TSFixMe) {
    // will eventually call `exploreReducer`: SET_FIELD_VALUE
    // @ts-expect-error TS(2339): Property 'valueKey' does not exist on type 'Readon... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(onChangeVal, []);
  }

  getOptions(props: $TSFixMe) {
    return innerGetOptions(props);
  }

  handleFilterOptions(text: $TSFixMe, option: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'filterOption' does not exist on type 'Re... Remove this comment to see the full error message
    const { filterOption } = this.props;
    return filterOption({ data: option }, text);
  }

  render() {
    const {
      // @ts-expect-error TS(2339): Property 'ariaLabel' does not exist on type 'Reado... Remove this comment to see the full error message
      ariaLabel,
      // @ts-expect-error TS(2339): Property 'autoFocus' does not exist on type 'Reado... Remove this comment to see the full error message
      autoFocus,
      // @ts-expect-error TS(2339): Property 'clearable' does not exist on type 'Reado... Remove this comment to see the full error message
      clearable,
      // @ts-expect-error TS(2339): Property 'disabled' does not exist on type 'Readon... Remove this comment to see the full error message
      disabled,
      // @ts-expect-error TS(2339): Property 'filterOption' does not exist on type 'Re... Remove this comment to see the full error message
      filterOption,
      // @ts-expect-error TS(2339): Property 'freeForm' does not exist on type 'Readon... Remove this comment to see the full error message
      freeForm,
      // @ts-expect-error TS(2339): Property 'isLoading' does not exist on type 'Reado... Remove this comment to see the full error message
      isLoading,
      // @ts-expect-error TS(2339): Property 'isMulti' does not exist on type 'Readonl... Remove this comment to see the full error message
      isMulti,
      // @ts-expect-error TS(2339): Property 'label' does not exist on type 'Readonly<... Remove this comment to see the full error message
      label,
      // @ts-expect-error TS(2339): Property 'multi' does not exist on type 'Readonly<... Remove this comment to see the full error message
      multi,
      // @ts-expect-error TS(2339): Property 'name' does not exist on type 'Readonly<{... Remove this comment to see the full error message
      name,
      // @ts-expect-error TS(2339): Property 'notFoundContent' does not exist on type ... Remove this comment to see the full error message
      notFoundContent,
      // @ts-expect-error TS(2339): Property 'onFocus' does not exist on type 'Readonl... Remove this comment to see the full error message
      onFocus,
      // @ts-expect-error TS(2339): Property 'onSelect' does not exist on type 'Readon... Remove this comment to see the full error message
      onSelect,
      // @ts-expect-error TS(2339): Property 'onDeselect' does not exist on type 'Read... Remove this comment to see the full error message
      onDeselect,
      // @ts-expect-error TS(2339): Property 'placeholder' does not exist on type 'Rea... Remove this comment to see the full error message
      placeholder,
      // @ts-expect-error TS(2339): Property 'showHeader' does not exist on type 'Read... Remove this comment to see the full error message
      showHeader,
      // @ts-expect-error TS(2339): Property 'tokenSeparators' does not exist on type ... Remove this comment to see the full error message
      tokenSeparators,
      // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
      value,
      // ControlHeader props
      // @ts-expect-error TS(2339): Property 'description' does not exist on type 'Rea... Remove this comment to see the full error message
      description,
      // @ts-expect-error TS(2339): Property 'renderTrigger' does not exist on type 'R... Remove this comment to see the full error message
      renderTrigger,
      // @ts-expect-error TS(2339): Property 'rightNode' does not exist on type 'Reado... Remove this comment to see the full error message
      rightNode,
      // @ts-expect-error TS(2339): Property 'leftNode' does not exist on type 'Readon... Remove this comment to see the full error message
      leftNode,
      // @ts-expect-error TS(2339): Property 'validationErrors' does not exist on type... Remove this comment to see the full error message
      validationErrors,
      // @ts-expect-error TS(2339): Property 'onClick' does not exist on type 'Readonl... Remove this comment to see the full error message
      onClick,
      // @ts-expect-error TS(2339): Property 'hovered' does not exist on type 'Readonl... Remove this comment to see the full error message
      hovered,
      // @ts-expect-error TS(2339): Property 'tooltipOnClick' does not exist on type '... Remove this comment to see the full error message
      tooltipOnClick,
      // @ts-expect-error TS(2339): Property 'warning' does not exist on type 'Readonl... Remove this comment to see the full error message
      warning,
      // @ts-expect-error TS(2339): Property 'danger' does not exist on type 'Readonly... Remove this comment to see the full error message
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
        value ??
        // @ts-expect-error TS(2339): Property 'default' does not exist on type 'Readonl... Remove this comment to see the full error message
        (this.props.default !== undefined ? this.props.default : undefined);

      // safety check - the value is intended to be undefined but null was used
      if (
        currentValue === null &&
        // @ts-expect-error TS(2339): Property 'options' does not exist on type 'Readonl... Remove this comment to see the full error message
        !this.state.options.find((o: $TSFixMe) => o.value === null)
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
      // @ts-expect-error TS(2339): Property 'mode' does not exist on type 'Readonly<{... Remove this comment to see the full error message
      mode: this.props.mode || (isMulti || multi ? 'multiple' : 'single'),
      name: `select-${name}`,
      onChange: this.onChange,
      onFocus,
      onSelect,
      onDeselect,
      // @ts-expect-error TS(2339): Property 'options' does not exist on type 'Readonl... Remove this comment to see the full error message
      options: this.state.options,
      placeholder,
      // @ts-expect-error TS(2339): Property 'sortComparator' does not exist on type '... Remove this comment to see the full error message
      sortComparator: this.props.sortComparator,
      value: getValue(),
      tokenSeparators,
      notFoundContent,
    };

    return (
      <div
        css={theme => css`
          .type-label {
            margin-right: ${theme.sizeUnit * 2}px;
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

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
SelectControl.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
SelectControl.defaultProps = defaultProps;
