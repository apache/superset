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
import { t, css } from '@superset-ui/core';
import { Select } from 'src/components/Select';
import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  autoFocus: PropTypes.bool,
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  disabled: PropTypes.bool,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
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
  showHeader: PropTypes.bool,
  optionRenderer: PropTypes.func,
  valueRenderer: PropTypes.func,
  valueKey: PropTypes.string,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  filterOption: PropTypes.func,

  // ControlHeader props
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
      value: this.props.value,
    };
    this.onChange = this.onChange.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (
      nextProps.choices !== this.props.choices ||
      nextProps.options !== this.props.options
    ) {
      const options = this.getOptions(nextProps);
      this.setState({ options });
    }
  }

  getOptions(props) {
    let options = [];
    if (props.options) {
      options = props.options.map(x => x);
    } else if (props.choices) {
      // Accepts different formats of input
      options = props.choices.map(c => {
        if (Array.isArray(c)) {
          const [value, label] = c.length > 1 ? c : [c[0], c[0]];
          return { label, [props.valueKey]: value };
        }
        if (Object.is(c)) {
          return c;
        }
        return { label: c, [props.valueKey]: c };
      });
    }
    return options;
  }

  render() {
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const {
      autoFocus,
      clearable,
      disabled,
      filterOption,
      isLoading,
      isMulti,
      label,
      multi,
      name,
      placeholder,
      onChange,
      onFocus,
      optionRenderer,
      showHeader,
      value,
      valueKey,
      valueRenderer,
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

    const selectProps = {
      allowNewOptions: this.props.freeForm,
      autoFocus,
      ariaLabel: label,
      allowClear: clearable,
      disabled,
      filterOption,
      header: showHeader && <ControlHeader {...headerProps} />,
      loading: isLoading,
      mode: isMulti || multi ? 'multiple' : 'single',
      name: `select-${name}`,
      onChange,
      onFocus,
      optionRenderer,
      value,
      options: this.state.options,
      placeholder,
      valueKey,
      valueRenderer,
    };

    return (
      <div
        css={theme => css`
          .type-label {
            margin-right: ${theme.gridUnit * 2}px;
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
