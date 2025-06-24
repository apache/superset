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
import { styled, t } from '@superset-ui/core';
import { Button, Icons, InfoTooltip, Tooltip, Flex } from '..';
import { Input } from '../Input';
import { FormLabel } from './FormLabel';
import { FormItem } from './FormItem';
import type { LabeledErrorBoundInputProps } from './types';

const StyledInput = styled(Input)`
  margin: ${({ theme }) => `${theme.sizeUnit}px 0 ${theme.sizeUnit * 2}px`};
`;

const StyledInputPassword = styled(Input.Password)`
  margin: ${({ theme }) => `${theme.sizeUnit}px 0 ${theme.sizeUnit * 2}px`};
`;

const StyledFormGroup = styled('div')`
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  margin-bottom: ${({ theme }) => theme.sizeUnit * 3}px;
  .ant-form-item {
    margin-bottom: 0;
  }
`;

const StyledFormLabel = styled(FormLabel)`
  margin-bottom: 0;
`;

export const LabeledErrorBoundInput = ({
  label,
  validationMethods,
  errorMessage,
  helpText,
  required = false,
  hasTooltip = false,
  tooltipText,
  id,
  className,
  visibilityToggle,
  get_url,
  description,
  isValidating = false,
  ...props
}: LabeledErrorBoundInputProps) => {
  const hasError = !!errorMessage;
  return (
    <StyledFormGroup className={className}>
      <Flex align="center">
        <StyledFormLabel htmlFor={id} required={required}>
          {label}
        </StyledFormLabel>
        {hasTooltip && <InfoTooltip tooltip={`${tooltipText}`} />}
      </Flex>
      <FormItem
        validateTrigger={Object.keys(validationMethods)}
        validateStatus={
          isValidating ? 'validating' : hasError ? 'error' : 'success'
        }
        help={errorMessage || helpText}
        hasFeedback={!!hasError}
      >
        {visibilityToggle || props.name === 'password' ? (
          <StyledInputPassword
            {...props}
            {...validationMethods}
            iconRender={visible =>
              visible ? (
                <Tooltip title={t('Hide password.')}>
                  <Icons.EyeInvisibleOutlined iconSize="m" />
                </Tooltip>
              ) : (
                <Tooltip title={t('Show password.')}>
                  <Icons.EyeOutlined iconSize="m" data-test="icon-eye" />
                </Tooltip>
              )
            }
            role="textbox"
          />
        ) : (
          <StyledInput {...props} {...validationMethods} />
        )}
        {get_url && description ? (
          <Button
            type="link"
            htmlType="button"
            onClick={() => {
              window.open(get_url);
              return true;
            }}
          >
            Get {description}
          </Button>
        ) : (
          <br />
        )}
      </FormItem>
    </StyledFormGroup>
  );
};
export default LabeledErrorBoundInput;
