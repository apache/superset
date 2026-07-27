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
import { forwardRef, HTMLAttributes, MouseEventHandler } from 'react';
import { styled, SupersetTheme } from '@apache-superset/core/theme';

interface IconButtonProps extends HTMLAttributes<HTMLButtonElement> {
  icon: JSX.Element;
  label?: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  'data-test'?: string;
}

const disabledCss = `
  cursor: not-allowed;
  opacity: 0.5;
`;

const activeCss = ({ theme }: { theme: SupersetTheme }) => `
  &:hover {
    color: ${theme.colorPrimary};
    background: ${theme.colorBgTextHover};
  }
`;

const StyledButton = styled.button<{ isDisabled?: boolean }>`
  appearance: none;
  border: none;
  background: none;
  font: inherit;
  display: flex;
  align-items: center;
  cursor: pointer;
  color: ${({ theme }) => theme.colorIcon};
  padding: ${({ theme }) => theme.paddingXXS}px;
  border-radius: ${({ theme }) => theme.borderRadiusXS}px;

  ${({ isDisabled, theme }) => (isDisabled ? disabledCss : activeCss({ theme }))}
`;

const StyledSpan = styled.span`
  margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      onClick,
      onKeyDown,
      disabled,
      'data-test': dataTest,
      ...rest
    },
    ref,
  ) => (
    <StyledButton
      {...rest}
      ref={ref}
      type="button"
      isDisabled={disabled}
      aria-disabled={disabled}
      data-test={dataTest}
      onClick={e => {
        e.preventDefault();
        if (!disabled) {
          onClick(e);
        }
      }}
      onKeyDown={e => {
        if (!disabled) {
          onKeyDown?.(e);
        }
      }}
    >
      {icon}
      {label && <StyledSpan>{label}</StyledSpan>}
    </StyledButton>
  ),
);

export default IconButton;
