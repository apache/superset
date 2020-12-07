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
import { Select } from 'src/components/Select';

export default class OnPasteSelect extends React.Component {
  constructor(props) {
    super(props);
    this.onPaste = this.onPaste.bind(this);
  }

  onPaste(evt) {
    if (!this.props.isMulti) {
      return;
    }
    evt.preventDefault();
    const clipboard = evt.clipboardData.getData('Text');
    if (!clipboard) {
      return;
    }
    const regex = `[${this.props.separator}]+`;
    const values = clipboard.split(new RegExp(regex)).map(v => v.trim());
    const validator = this.props.isValidNewOption;
    const selected = this.props.value || [];
    const existingOptions = {};
    const existing = {};
    this.props.options.forEach(v => {
      existingOptions[v[this.props.valueKey]] = 1;
    });
    let options = [];
    selected.forEach(v => {
      options.push({ [this.props.labelKey]: v, [this.props.valueKey]: v });
      existing[v] = 1;
    });
    options = options.concat(
      values
        .filter(v => {
          const notExists = !existing[v];
          existing[v] = 1;
          return (
            notExists &&
            (validator ? validator({ [this.props.labelKey]: v }) : !!v)
          );
        })
        .map(v => {
          const opt = { [this.props.labelKey]: v, [this.props.valueKey]: v };
          if (!existingOptions[v]) {
            this.props.options.unshift(opt);
          }
          return opt;
        }),
    );
    if (options.length) {
      if (this.props.onChange) {
        this.props.onChange(options);
      }
    }
  }

  render() {
    const { selectWrap: SelectComponent, ...restProps } = this.props;
    return (
      <SelectComponent
        {...restProps}
        onPaste={this.onPaste}
        menuPortalTarget={document.body}
      />
    );
  }
}

OnPasteSelect.propTypes = {
  separator: PropTypes.array,
  selectWrap: PropTypes.elementType,
  selectRef: PropTypes.func,
  onChange: PropTypes.func.isRequired,
  valueKey: PropTypes.string,
  labelKey: PropTypes.string,
  options: PropTypes.array,
  isMulti: PropTypes.bool,
  value: PropTypes.any,
  isValidNewOption: PropTypes.func,
  noResultsText: PropTypes.string,
};
OnPasteSelect.defaultProps = {
  separator: [',', '\n', '\t', ';'],
  selectWrap: Select,
  valueKey: 'value',
  labelKey: 'label',
  options: [],
  isMulti: false,
};
