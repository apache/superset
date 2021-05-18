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
import { styled, css, SupersetTheme } from '@superset-ui/core';
import FormItem from './FormItem';
import FormLabel from './FormLabel';

export interface LabeledErrorBoundInputProps {
  label?: string;
  validationMethods:
    | { onBlur: (value: any) => string }
    | { onChange: (value: any) => string };
  errorMessage: string | null;
  helpText?: string;
  required?: boolean;
  id?: string;
  [x: string]: any;
}

const StyledInput = styled(Input)`
  margin: 8px 0;
`;

const alertIconStyles = (theme: SupersetTheme, hasError: boolean) => css`
  .ant-form-item-children-icon {
    display: none;
  }
  ${hasError &&
  `.ant-form-item-control-input-content {
      position: relative;

      &:after {
        content: ' ';
        display: inline-block;
        background: ${theme.colors.error.base};
        mask: url('/images/icons/error.svg');
        mask-size: cover;
        width: ${theme.gridUnit * 4}px;
        height: ${theme.gridUnit * 4}px;
        position: absolute;
        right: 7px;
        top: 15px;
      }
    }`}
`;

const LabeledErrorBoundInput = ({
  label,
  validationMethods,
  errorMessage,
  helpText,
  required = false,
  id,
  ...props
}: LabeledErrorBoundInputProps) => (
  <>
    <FormLabel htmlFor={id} required={required}>
      {label}
    </FormLabel>
    <FormItem
      css={(theme: SupersetTheme) => alertIconStyles(theme, !!errorMessage)}
      validateTrigger={Object.keys(validationMethods)}
      validateStatus={errorMessage ? 'error' : 'success'}
      help={errorMessage || helpText}
      hasFeedback={!!errorMessage}
    >
      <StyledInput {...props} {...validationMethods} />
    </FormItem>
  </>
);

export default LabeledErrorBoundInput;
