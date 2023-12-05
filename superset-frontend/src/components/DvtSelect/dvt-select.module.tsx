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
  typeDesign: string;
}

interface StyledSelectLabelProps {
  typeDesign: string;
}

interface StyledSelectOptionsProps {
  isOpen: boolean;
  label: string;
  itemLength: number;
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
  display: inline-flex;
  flex-direction: column;
`;

const StyledSelectSelect = styled.div<StyledSelectProps>`
  position: relative;
  display: flex;
  align-items: center;
  padding: 12px;
  width: 202px;
  height: 48px;
  border-radius: 12px;
  background-color: ${({ isOpen, theme, typeDesign }) =>
    isOpen
      ? theme.colors.dvt.primary.light2
      : typeDesign === 'form'
      ? theme.colors.grayscale.light5
      : theme.colors.dvt.grayscale.light2};
  border: none;
  appearance: none;
  margin-bottom: 3px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.dvt.primary.light1};
  transition: background-color 0.3s ease-in-out;
`;

const StyledSelectLabel = styled.label<StyledSelectLabelProps>`
  padding-left: 13px;
  font-weight: 600;
  color: ${({ typeDesign, theme }) =>
    typeDesign === 'form'
      ? theme.colors.dvt.text.label
      : theme.colors.grayscale.dark2};
`;

const StyledSelectOption = styled.div<StyledSelectOptionProps>`
  padding: 13px;
  cursor: pointer;
  ${({ theme, value, selectedValue }) =>
    value === selectedValue
      ? `
        color: ${theme.colors.grayscale.light5};
        background: ${theme.colors.dvt.primary.light1};
      `
      : `
        color: ${theme.colors.dvt.primary.light1};
      }
    `}
`;
const StyledSelectOptions = styled.div<StyledSelectOptionsProps>`
  position: absolute;
  top: ${({ label }) => (label ? '74px' : '52px')};
  left: 0;
  right: 0;
  border-radius: ${({ itemLength }) =>
    itemLength > 6 ? '12px 0 0 12px' : '12px'};
  background: ${({ theme }) => theme.colors.dvt.primary.light2};
  max-height: 274px;
  overflow-y: auto;
  animation: ${optionsKeyframes} 0.3s ease-in-out;
  transform-origin: top;
  z-index: 999;
  &::-webkit-scrollbar {
    background-color: ${({ theme }) => theme.colors.dvt.grayscale.light1};
    width: 6px;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.colors.dvt.grayscale.base};
    border-radius: 3px;
  }
`;
const StyledSelectIcon = styled.div<StyledSelectProps>`
  position: absolute;
  right: 12px;
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
