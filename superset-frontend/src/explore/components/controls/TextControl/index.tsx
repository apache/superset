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
import { legacyValidateNumber, legacyValidateInteger } from '@superset-ui/core';
import debounce from 'lodash/debounce';
import { FAST_DEBOUNCE } from 'src/constants';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Input } from 'src/components/Input';

type InputValueType = string | number;

export interface TextControlProps<T extends InputValueType = InputValueType> {
  label?: string;
  disabled?: boolean;
  isFloat?: boolean;
  isInt?: boolean;
  onChange?: (value: T, errors: any) => void;
  onFocus?: () => {};
  placeholder?: string;
  value?: T | null;
  controlId?: string;
  renderTrigger?: boolean;
}

export interface TextControlState {
  value: string;
}

const safeStringify = (value?: InputValueType | null) =>
  value == null ? '' : String(value);

export default class TextControl<
  T extends InputValueType = InputValueType,
> extends React.Component<TextControlProps<T>, TextControlState> {
  initialValue?: TextControlProps['value'];

  constructor(props: TextControlProps<T>) {
    super(props);
    this.initialValue = props.value;
    this.state = {
      value: safeStringify(this.initialValue),
    };
  }

  onChange = (inputValue: string) => {
    let parsedValue: InputValueType = inputValue;
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
    this.props.onChange?.(parsedValue as T, errors);
  };

  debouncedOnChange = debounce((inputValue: string) => {
    this.onChange(inputValue);
  }, FAST_DEBOUNCE);

  onChangeWrapper = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    this.setState({ value }, () => {
      this.debouncedOnChange(value);
    });
  };

  render() {
    let { value } = this.state;
    if (this.initialValue !== this.props.value) {
      this.initialValue = this.props.value;
      value = safeStringify(this.props.value);
    }
    return (
      <div>
        <ControlHeader {...this.props} />
        <Input
          type="text"
          data-test="inline-name"
          placeholder={this.props.placeholder}
          onChange={this.onChangeWrapper}
          onFocus={this.props.onFocus}
          value={value}
          disabled={this.props.disabled}
          aria-label={this.props.label}
        />
      </div>
    );
  }
}
