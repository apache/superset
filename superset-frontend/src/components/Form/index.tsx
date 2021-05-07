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
import { Input } from 'antd';
import { css } from '@emotion/core';
import Form from './Form';
import FormItem from './FormItem';
import FormLabel from './FormLabel';

interface LabeledErrorBoundInputProps {
  label?: string;
  name: string;
  validationMethods:
    | { onBlur: (value: any) => void }
    | { onChange: (value: any) => void };
  errorMessage: string | null;
  helpText?: string;
  value: string | number | readonly string[] | undefined;
  required?: boolean;
  placeholder?: string;
  autocomplete?: string;
  type?: string;
  id?: string;
}

const input_margin = css`
  .ant-form-item-control-input > input {
    margin: 8px 0;
  }
`;

const LabeledErrorBoundInput = ({
  label,
  name,
  validationMethods,
  errorMessage,
  helpText,
  value,
  required = false,
  placeholder,
  autocomplete,
  type,
  id,
}: LabeledErrorBoundInputProps) => (
  <>
    <FormLabel required={required}>{label} </FormLabel>
    <FormItem
      name={name}
      validateTrigger={Object.keys(validationMethods)}
      validateStatus={errorMessage ? 'error' : 'success'}
      help={errorMessage || helpText}
      id={id}
      placeholder={placeholder}
      autocomplete={autocomplete}
      type={type}
    >
      <Input css={{ ...input_margin }} value={value} {...validationMethods} />
    </FormItem>
  </>
);

export default LabeledErrorBoundInput;

export { Form, FormItem, FormLabel };
