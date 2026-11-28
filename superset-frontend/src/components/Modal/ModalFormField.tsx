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
import {
  Children,
  ReactElement,
  ReactNode,
  RefAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
} from 'react';
import { css, styled } from '@apache-superset/core/theme';
import { FormItem, InfoTooltip } from '@superset-ui/core/components';

interface ModalFormFieldProps {
  label: string;
  required?: boolean;
  tooltip?: ReactNode;
  error?: string;
  helperText?: string;
  bottomSpacing?: boolean;
  children: ReactNode;
  testId?: string;
}

type FieldAriaProps = {
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  children?: ReactNode;
};

type DescribedControlProps = {
  control: ReactElement<FieldAriaProps & RefAttributes<unknown>>;
  errorId?: string;
  'aria-invalid'?: boolean;
};

// A named FormItem gives its child an aria-describedby pointing at its own
// help element, which it does not render when noStyle is set. Rendering the
// control through this component receives the FormItem props and re-applies
// the field error id after them.
const DescribedControl = forwardRef<unknown, DescribedControlProps>(
  ({ control, errorId, ...formItemProps }, ref) =>
    cloneElement(control, {
      ...formItemProps,
      ref,
      ...(errorId ? { 'aria-describedby': errorId } : {}),
    }),
);

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
}: ModalFormFieldProps) {
  const errorId = useId();
  const ariaProps: FieldAriaProps = error
    ? { 'aria-invalid': true, 'aria-describedby': errorId }
    : {};

  // Associate the error with the field input. Call sites may wrap the input
  // in a FormItem, so the attributes are applied to its single child.
  // Children.map always runs so the element tree keeps its shape and the
  // input is not remounted when the error toggles.
  const applyAria = (element: ReactElement<FieldAriaProps>) => {
    if (element.type !== FormItem) {
      return cloneElement(element, ariaProps);
    }
    const wrappedChild = element.props.children;
    return isValidElement<FieldAriaProps>(wrappedChild)
      ? cloneElement(element, {
          children: (
            <DescribedControl
              control={wrappedChild}
              errorId={ariaProps['aria-describedby']}
              aria-invalid={ariaProps['aria-invalid']}
            />
          ),
        })
      : element;
  };
  const fieldChildren = Children.map(children, (child, index) =>
    index === 0 && isValidElement<FieldAriaProps>(child)
      ? applyAria(child)
      : child,
  );

  return (
    <StyledFieldContainer bottomSpacing={bottomSpacing} data-test={testId}>
      <div className="control-label">
        {label}
        {tooltip && <InfoTooltip tooltip={tooltip} />}
        {required && <span className="required">*</span>}
      </div>
      <div className="input-container">{fieldChildren}</div>
      {helperText && <div className="helper">{helperText}</div>}
      {error && (
        <div className="error" id={errorId} role="alert">
          {error}
        </div>
      )}
    </StyledFieldContainer>
  );
}
