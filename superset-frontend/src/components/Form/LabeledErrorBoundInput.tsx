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
import { Tooltip } from 'src/components/Tooltip';
import { Input } from 'src/components/Input';
import InfoTooltip from 'src/components/InfoTooltip';
import { Icons } from 'src/components/Icons';
import Button from 'src/components/Button';
import FormItem from './FormItem';
import FormLabel from './FormLabel';

export interface LabeledErrorBoundInputProps {
  label?: string;
  validationMethods:
    | { onBlur: (value: any) => void }
    | { onChange: (value: any) => void };
  errorMessage?: string | null;
  helpText?: string;
  required?: boolean;
  hasTooltip?: boolean;
  tooltipText?: string | null;
  id?: string;
  classname?: string;
  visibilityToggle?: boolean;
  [x: string]: any;
}

const StyledInput = styled(Input)`
  margin: ${({ theme }) => `${theme.gridUnit}px 0 ${theme.gridUnit * 2}px`};
`;

const StyledInputPassword = styled(Input.Password)`
  margin: ${({ theme }) => `${theme.gridUnit}px 0 ${theme.gridUnit * 2}px`};
`;

const StyledFormGroup = styled('div')`
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  .ant-form-item {
    margin-bottom: 0;
  }
`;

const StyledAlignment = styled.div`
  display: flex;
  align-items: center;
`;

const StyledFormLabel = styled(FormLabel)`
  margin-bottom: 0;
`;

const LabeledErrorBoundInput = ({
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
      <StyledAlignment>
        <StyledFormLabel htmlFor={id} required={required}>
          {label}
        </StyledFormLabel>
        {hasTooltip && <InfoTooltip tooltip={`${tooltipText}`} />}
      </StyledAlignment>
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
            buttonStyle="default"
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
