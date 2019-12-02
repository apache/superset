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
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-virtualized-select';
import FormHelpText from './FormHelpText';
import './FormSelect.css';

const propTypes = {
  id: PropTypes.string,
  value: PropTypes.object,
  options: PropTypes.array,
  onChange: PropTypes.func,
  required: PropTypes.bool,
  clearable: PropTypes.bool,
  helpText: PropTypes.string,
  disabled: PropTypes.bool,
};

export default class FormSelect extends PureComponent {
  render() {
    const {
      id,
      value,
      options,
      onChange,
      required,
      clearable,
      helpText,
      disabled,
    } = this.props;
    const help = helpText && <FormHelpText helpText={helpText} />;
    return (
      <>
        <Select
          classname={disabled ? 'disabled-component' : null}
          id={id}
          value={value}
          onChange={onChange}
          options={options}
          clearable={clearable}
          required={required}
          disabled={disabled}
        />
        {help}
      </>
    );
  }
}

FormSelect.propTypes = propTypes;
