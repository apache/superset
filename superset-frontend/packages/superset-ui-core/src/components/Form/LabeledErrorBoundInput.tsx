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
import { styled, css, SupersetTheme, t } from '../..';
import { error as errorIcon } from '../assets/svgs';
import { Button, Icons, InfoTooltip, Tooltip } from '..';
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
        background: ${theme.colorError};
        mask: url(${errorIcon});
        mask-size: cover;
        width: ${theme.sizeUnit * 4}px;
        height: ${theme.sizeUnit * 4}px;
        position: absolute;
        right: ${theme.sizeUnit * 1.25}px;
        top: ${theme.sizeUnit * 2.75}px;
      }
    }`}
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

const StyledAlignment = styled.div`
  display: flex;
  align-items: center;
`;

const StyledFormLabel = styled(FormLabel)`
  margin-bottom: 0;
`;

const iconReset = css`
  &.anticon > * {
    line-height: 0;
  }
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
  ...props
}: LabeledErrorBoundInputProps) => (
  <StyledFormGroup className={className}>
    <StyledAlignment>
      <StyledFormLabel htmlFor={id} required={required}>
        {label}
      </StyledFormLabel>
      {hasTooltip && <InfoTooltip tooltip={`${tooltipText}`} />}
    </StyledAlignment>
    <FormItem
      css={(theme: SupersetTheme) => alertIconStyles(theme, !!errorMessage)}
      validateTrigger={Object.keys(validationMethods)}
      validateStatus={errorMessage ? 'error' : 'success'}
      help={errorMessage || helpText}
      hasFeedback={!!errorMessage}
    >
      {visibilityToggle || props.name === 'password' ? (
        <StyledInputPassword
          {...props}
          {...validationMethods}
          iconRender={visible =>
            visible ? (
              <Tooltip title={t('Hide password.')}>
                <Icons.EyeInvisibleOutlined iconSize="m" css={iconReset} />
              </Tooltip>
            ) : (
              <Tooltip title={t('Show password.')}>
                <Icons.EyeOutlined
                  iconSize="m"
                  css={iconReset}
                  data-test="icon-eye"
                />
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
          htmlType="button"
          buttonStyle="secondary"
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
