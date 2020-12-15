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
import { FormGroup, FormControl } from 'react-bootstrap';
import { legacyValidateNumber, legacyValidateInteger } from '@superset-ui/core';
import debounce from 'lodash/debounce';
import ControlHeader from '../ControlHeader';

interface TextControlProps {
  disabled?: boolean;
  isFloat?: boolean;
  isInt?: boolean;
  onChange?: (value: any, errors: any) => {};
  onFocus?: () => {};
  placeholder?: string;
  value?: string | number;
  controlId?: string;
  renderTrigger?: boolean;
}

interface TextControlState {
  controlId: string;
  value?: string | number;
}

const generateControlId = (controlId?: string) =>
  `formInlineName_${controlId ?? (Math.random() * 1000000).toFixed()}`;

export default class TextControl extends React.Component<
  TextControlProps,
  TextControlState
> {
  debouncedOnChange = debounce((inputValue: string) => {
    this.onChange(inputValue);
  }, 500);

  constructor(props: TextControlProps) {
    super(props);

    // if there's no control id provided, generate a random
    // number to prevent rendering elements with same ids
    this.state = {
      controlId: generateControlId(props.controlId),
      value: props.value,
    };
  }

  onChange = (inputValue: string) => {
    let parsedValue: string | number = inputValue;
    // Validation & casting
    const errors = [];
    if (inputValue !== '' && this.props.isFloat) {
      const error = legacyValidateNumber(inputValue);
      if (error) {
        errors.push(error);
      } else {
        parsedValue = inputValue.match(/.*([.0])$/g)
          ? inputValue
          : parseFloat(inputValue);
      }
    }
    if (inputValue !== '' && this.props.isInt) {
      const error = legacyValidateInteger(inputValue);
      if (error) {
        errors.push(error);
      } else {
        parsedValue = parseInt(inputValue, 10);
      }
    }
    this.props.onChange?.(parsedValue, errors);
  };

  onChangeWrapper = (event: any) => {
    const { value } = event.target;
    this.setState({ value });

    // use debounce when change takes effect immediately after user starts typing
    const onChange = this.props.renderTrigger
      ? this.debouncedOnChange
      : this.onChange;
    onChange(value);
  };

  render = () => {
    const { value: rawValue } = this.state;
    const value =
      typeof rawValue !== 'undefined' && rawValue !== null
        ? rawValue.toString()
        : '';

    return (
      <div>
        <ControlHeader {...this.props} />
        <FormGroup controlId={this.state.controlId} bsSize="small">
          <FormControl
            type="text"
            data-test="inline-name"
            placeholder={this.props.placeholder}
            onChange={this.onChangeWrapper}
            onFocus={this.props.onFocus}
            value={value}
            disabled={this.props.disabled}
          />
        </FormGroup>
      </div>
    );
  };
}
