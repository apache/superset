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
import { Input, Tooltip } from 'antd';
import { styled, css, SupersetTheme, t } from '@superset-ui/core';
import InfoTooltip from 'src/components/InfoTooltip';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import errorIcon from 'src/assets/images/icons/error.svg';
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
        mask: url(${errorIcon});
        mask-size: cover;
        width: ${theme.gridUnit * 4}px;
        height: ${theme.gridUnit * 4}px;
        position: absolute;
        right: ${theme.gridUnit * 1.25}px;
        top: ${theme.gridUnit * 2.75}px;
      }
    }`}
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

const iconReset = css`
  &.anticon > * {
    line-height: 0;
  }
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

export default LabeledErrorBoundInput;
