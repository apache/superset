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
import { isFunction } from 'lodash';
import { Creatable } from 'react-select';
import ControlHeader from '../ControlHeader';
import TooltipWrapper from '../../../components/TooltipWrapper';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string,
  default: PropTypes.string,
  choices: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.array),
    PropTypes.func,
  ]).isRequired,
  schemes: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.func,
  ]).isRequired,
  isLinear: PropTypes.bool,
};

const defaultProps = {
  choices: [],
  schemes: {},
  onChange: () => {},
};

export default class ColorSchemeControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      scheme: this.props.value,
    };

    this.onChange = this.onChange.bind(this);
    this.renderOption = this.renderOption.bind(this);
  }

  onChange(option) {
    const optionValue = option ? option.value : null;
    this.props.onChange(optionValue);
    this.setState({ scheme: optionValue });
  }

  renderOption(key) {
    const { isLinear, schemes } = this.props;
    const schemeLookup = isFunction(schemes) ? schemes() : schemes;
    const currentScheme = schemeLookup[key.value || defaultProps.value];

    // For categorical scheme, display all the colors
    // For sequential scheme, show 10 or interpolate to 10.
    // Sequential schemes usually have at most 10 colors.
    let colors = [];
    if (currentScheme) {
      colors = isLinear ? currentScheme.getColors(10) : currentScheme.colors;
    }

    return (
      <TooltipWrapper
        label={`${currentScheme.id}-tooltip`}
        tooltip={currentScheme.label}
      >
        <ul className="color-scheme-container">
          {colors.map((color, i) => (
            <li
              key={`${currentScheme.id}-${i}`}
              style={{
                backgroundColor: color,
                border: `1px solid ${color === 'white' ? 'black' : color}`,
              }}
            >&nbsp;</li>
          ))}
        </ul>
      </TooltipWrapper>
    );
  }

  render() {
    const { choices } = this.props;
    const options = (isFunction(choices) ? choices() : choices)
      .map(choice => ({ value: choice[0], label: choice[1] }));

    const selectProps = {
      multi: false,
      name: `select-${this.props.name}`,
      placeholder: `Select (${options.length})`,
      default: this.props.default,
      options,
      value: this.props.value,
      autosize: false,
      clearable: false,
      onChange: this.onChange,
      optionRenderer: this.renderOption,
      valueRenderer: this.renderOption,
    };
    return (
      <div>
        <ControlHeader {...this.props} />
        <Creatable {...selectProps} />
      </div>
    );
  }
}

ColorSchemeControl.propTypes = propTypes;
ColorSchemeControl.defaultProps = defaultProps;
