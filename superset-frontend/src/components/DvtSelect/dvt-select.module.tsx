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
import { keyframes, styled } from '@superset-ui/core';

interface StyledSelectProps {
  isOpen: boolean;
}

const optionsKeyframes = keyframes`
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
`;

interface StyledSelectOptionProps {
  selectedValue: string;
  value: string;
}

const StyledSelect = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
`;

const StyledSelectSelect = styled.div<StyledSelectProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  width: 202px;
  height: 48px;
  border-radius: 12px;
  background-color: ${({ isOpen, theme }) =>
    isOpen
      ? theme.colors.dvt.primary.light2
      : theme.colors.dvt.grayscale.light2};
  border: none;
  appearance: none;
  margin-bottom: 3px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.dvt.primary.light1};
  transition: background-color 0.3s ease-in-out;
`;

const StyledSelectLabel = styled.label`
  padding-left: 13px;
  font-weight: 600;
`;

const StyledSelectOption = styled.div<StyledSelectOptionProps>`
  padding: 13px;
  cursor: pointer;
  ${({ theme, value, selectedValue }) =>
    value === selectedValue
      ? `
        color: ${theme.colors.grayscale.light5};
        background: ${theme.colors.dvt.primary.light1};
        &:first-of-type {
          border-radius: 12px 12px 0px 0px;
        }
        &:last-of-type {
          border-radius: 0px 0px 12px 12px;
        }
      `
      : `
        color: ${theme.colors.dvt.primary.light1};
      }
    `}
`;
const StyledSelectOptions = styled.div<StyledSelectProps>`
  position: absolute;
  top: 105px;
  width: 202px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.dvt.primary.light2};
  max-height: 274px;
  overflow-y: auto;
  animation: ${optionsKeyframes} 0.3s ease-in-out;
`;
const StyledSelectIcon = styled.div<StyledSelectProps>`
  display: flex;
  justify-content: flex-end;
  transition: transform 0.3s ease-in-out;
  transform: ${({ isOpen }) => (isOpen ? 'rotate(90deg)' : 'none')};
`;

export {
  StyledSelect,
  StyledSelectOption,
  StyledSelectLabel,
  StyledSelectSelect,
  StyledSelectIcon,
  StyledSelectOptions,
};
