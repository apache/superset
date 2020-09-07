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
import {
  legacyValidateNumber,
  legacyValidateInteger,
} from '@superset-ui/validator';
import ControlHeader from '../ControlHeader';

interface TextControlProps {
  disabled: boolean;
  isFloat: boolean;
  isInt: boolean;
  onChange: (value: any, errors: any) => {};
  onFocus: () => {};
  placeholder: string;
  value: string | number;
}

export default class TextControl extends React.Component<TextControlProps> {
  constructor(props: TextControlProps) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }
  onChange(event: any) {
    let value = event.target.value;

    // Validation & casting
    const errors = [];
    if (value !== '' && this.props.isFloat) {
      const error = legacyValidateNumber(value);
      if (error) {
        errors.push(error);
      } else {
        value = value.match(/.*(\.|0)$/g) ? value : parseFloat(value);
      }
    }
    if (value !== '' && this.props.isInt) {
      const error = legacyValidateInteger(value);
      if (error) {
        errors.push(error);
      } else {
        value = parseInt(value, 10);
      }
    }
    this.props.onChange(value, errors);
  }
  render() {
    const { value: rawValue } = this.props;
    const value =
      typeof rawValue !== 'undefined' && rawValue !== null
        ? rawValue.toString()
        : '';
    return (
      <div>
        <ControlHeader {...this.props} />
        <FormGroup controlId="formInlineName" bsSize="small">
          <FormControl
            type="text"
            placeholder={this.props.placeholder}
            onChange={this.onChange}
            onFocus={this.props.onFocus}
            value={value}
            disabled={this.props.disabled}
          />
        </FormGroup>
      </div>
    );
  }
}
