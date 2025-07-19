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
import { MouseEventHandler } from 'react';
import { styled } from '@superset-ui/core';
import { Theme } from '@emotion/react';

interface IconButtonProps {
  icon: JSX.Element;
  label?: string;
  onClick: MouseEventHandler<HTMLDivElement>;
  disabled?: boolean;
}

const StyledDiv = styled.div<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.grayscale.base};
  padding: ${({ theme }) => theme.paddingXXS}px;
  border-radius: ${({ theme }) => theme.borderRadiusXS}px;

  ${({ disabled, theme }) => (disabled ? disabledCss : activeCss({ theme }))}
`;

const disabledCss = `
  cursor: not-allowed;
  opacity: 0.5;
`;

const activeCss = ({ theme }: { theme: Theme }) => `
  &:hover {
    color: ${theme.colorPrimary};
    background: ${theme.colorBgTextHover};
  }
`;

const StyledSpan = styled.span`
  margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const IconButton = ({ icon, label, onClick, disabled }: IconButtonProps) => (
  <StyledDiv
    tabIndex={0}
    role="button"
    disabled={disabled}
    onClick={e => {
      e.preventDefault();
      if (!disabled) {
        onClick(e);
      }
    }}
  >
    {icon}
    {label && <StyledSpan>{label}</StyledSpan>}
  </StyledDiv>
);

export default IconButton;
