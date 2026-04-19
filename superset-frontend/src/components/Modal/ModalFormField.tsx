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
import { ReactNode, Children, isValidElement, cloneElement, useId } from 'react';
import { css, styled } from '@apache-superset/core/theme';
import { InfoTooltip } from '@superset-ui/core/components';

interface ModalFormFieldProps {
  label: string;
  required?: boolean;
  tooltip?: ReactNode;
  error?: string;
  helperText?: string;
  bottomSpacing?: boolean;
  children: ReactNode;
  testId?: string;
  validateStatus?: 'success' | 'warning' | 'error' | 'validating';
  hasFeedback?: boolean;
}

const StyledFieldContainer = styled.div<{ bottomSpacing: boolean }>`
  ${({ theme, bottomSpacing }) => css`
    flex: 1;
    margin-top: 0px;
    margin-bottom: ${bottomSpacing ? theme.sizeUnit * 4 : 0}px;

    .control-label {
      margin-top: ${theme.sizeUnit}px;
      margin-bottom: ${theme.sizeUnit * 2}px;
      color: ${theme.colorText};
      font-size: ${theme.fontSize}px;
    }

    .required {
      margin-left: ${theme.sizeUnit / 2}px;
      color: ${theme.colorError};
    }

    .helper {
      display: block;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
      padding: ${theme.sizeUnit}px 0;
      text-align: left;
    }

    .error {
      color: ${theme.colorError};
      font-size: ${theme.fontSizeSM}px;
      margin-top: ${theme.sizeUnit}px;
    }

    .input-container {
      display: flex;
      align-items: center;

      > div {
        width: 100%;
      }

      label {
        display: flex;
        margin-right: ${theme.sizeUnit * 2}px;
      }

      i {
        margin: 0 ${theme.sizeUnit}px;
      }
    }

    input,
    textarea {
      flex: 1 1 auto;
    }

    input[disabled] {
      color: ${theme.colorTextDisabled};
    }

    textarea {
      resize: vertical;
    }

    input::placeholder,
    textarea::placeholder {
      color: ${theme.colorTextPlaceholder};
    }

    textarea,
    input[type='text'],
    input[type='number'] {
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
      border-style: none;
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;

      &[name='description'] {
        flex: 1 1 auto;
      }
    }
  `}
`;

export function ModalFormField({
  label,
  required = false,
  tooltip,
  error,
  helperText,
  bottomSpacing = true,
  children,
  testId,
  validateStatus,
  hasFeedback = false,
}: ModalFormFieldProps) {
  const uniqueId = useId();
  const errorId = error ? `${uniqueId}-error` : undefined;

  // Clone the first child element to inject aria-invalid and aria-describedby
  // on the real input. Many call sites wrap the input in a FormItem/Row so
  // the ARIA attrs must hop through wrappers to reach the actual interactive
  // element, otherwise screen readers never learn about the error.
  const applyAria = (element: React.ReactElement<any>): React.ReactElement<any> => {
    const ariaProps = {
      'aria-invalid': true,
      'aria-describedby': errorId,
    };
    const wrappedChild = element.props?.children;
    if (
      isValidElement(wrappedChild) &&
      Children.count(wrappedChild) === 1
    ) {
      return cloneElement(element, {
        children: cloneElement(
          wrappedChild as React.ReactElement<any>,
          ariaProps,
        ),
      });
    }
    return cloneElement(element, ariaProps);
  };

  const enhancedChildren = error
    ? Children.map(children, (child, index) => {
        if (index === 0 && isValidElement(child)) {
          return applyAria(child as React.ReactElement<any>);
        }
        return child;
      })
    : children;

  return (
    <StyledFieldContainer bottomSpacing={bottomSpacing} data-test={testId}>
      <div className="control-label">
        {label}
        {tooltip && <InfoTooltip tooltip={tooltip} />}
        {required && <span className="required">*</span>}
      </div>
      <div className="input-container">{enhancedChildren}</div>
      {helperText && <div className="helper">{helperText}</div>}
      {error && (
        <div className="error" id={errorId} role="alert">
          {error}
        </div>
      )}
    </StyledFieldContainer>
  );
}
