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
import { styled } from '@superset-ui/core';

interface DvtPopperProps {
  direction: string;
}

interface DvtPopperFontSizeProps {
  fontSize: 'small' | 'medium';
}

const StyledPopper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StyledPopperBody = styled.div<DvtPopperFontSizeProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.dvt.primary.base};
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.grayscale.light5};
  font-size: ${({ fontSize }) => (fontSize === 'small' ? '12px' : '16px')};
  font-weight: 500;
  line-height: 140%;
  letter-spacing: 0.2px;
  cursor: pointer;
  padding: ${({ fontSize }) =>
    fontSize === 'small' ? '8px 10px' : '10px 15px'};
  white-space: nowrap;
`;

const StyledPopperGroup = styled.div`
  position: relative;
`;

const StyledPopperAbsolute = styled.div<DvtPopperProps>`
  display: flex;
  flex-direction: ${({ direction }) =>
    direction === 'top' || direction === 'bottom' ? 'column' : 'row'};
  align-items: center;
  position: absolute;
  z-index: 999;

  &::before {
    content: '';
    position: absolute;
  }

  ${({ direction, theme }) => {
    if (direction === 'bottom') {
      return `
        left: 0;
        right: 0;
        top: calc(100% + 13px);

        &::before {
          top: -13px;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 13px solid ${theme.colors.dvt.primary.base};
        }
      `;
    }
    if (direction === 'top') {
      return `
        left: 0;
        right: 0;
        bottom: calc(100% + 13px);

        &::before {
          bottom: -13px;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 13px solid ${theme.colors.dvt.primary.base};
        }
      `;
    }
    if (direction === 'left') {
      return `
        top: 0;
        bottom: 0;
        right: calc(100% + 13px);

        &::before {
          right: -13px;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-left: 13px solid ${theme.colors.dvt.primary.base};
        }
      `;
    }
    if (direction === 'right') {
      return `
        top: 0;
        bottom: 0;
        left: calc(100% + 13px);

        &::before {
          left: -13px;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-right: 13px solid ${theme.colors.dvt.primary.base};
        }
      `;
    }
    return '';
  }};
`;

export {
  StyledPopper,
  StyledPopperBody,
  StyledPopperGroup,
  StyledPopperAbsolute,
};
