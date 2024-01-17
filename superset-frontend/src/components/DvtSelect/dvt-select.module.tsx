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
  selectedValue: string;
}

interface StyledSelectIconProps {
  isOpen: boolean;
}

interface StyledSelectLabelProps {
  typeDesign: string;
}

interface StyledSelectOptionsProps {
  isOpen: boolean;
  label: string;
  itemLength: number;
  typeDesign: string;
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
  selectedValue: boolean;
  typeDesign: string;
}

const StyledSelect = styled.div<StyledSelectLabelProps>`
  position: relative;
  display: inline-flex;
  flex-direction: column;
`;

const StyledSelectSelect = styled.div<StyledSelectProps>`
  position: relative;
  display: flex;
  align-items: center;
  padding: ${({ typeDesign }) => (typeDesign === 'form' ? '12px 8px' : '12px')};
  width: 100%;
  height: 48px;
  border-radius: ${({ typeDesign }) =>
    typeDesign === 'form' ? '4px' : '12px'};
  background-color: ${({ isOpen, theme, typeDesign }) =>
    typeDesign === 'form' || typeDesign === 'navbar'
      ? theme.colors.grayscale.light5
      : isOpen
      ? theme.colors.dvt.primary.light2
      : theme.colors.dvt.grayscale.light2};
  border: ${({ theme, typeDesign }) =>
    typeDesign === 'navbar'
      ? `1px solid ${theme.colors.dvt.primary.light2}`
      : 'none'};
  appearance: none;
  cursor: pointer;
  color: ${({ theme, selectedValue }) =>
    selectedValue
      ? theme.colors.grayscale.dark2
      : theme.colors.dvt.primary.light1};
  transition: background-color 0.3s ease-in-out;
`;

const StyledSelectLabel = styled.label<StyledSelectLabelProps>`
  margin-left: ${({ typeDesign }) => (typeDesign === 'form' ? '0' : '13px')};
  font-weight: 600;
  color: ${({ typeDesign, theme }) =>
    typeDesign === 'form'
      ? theme.colors.dvt.text.label
      : theme.colors.grayscale.dark2};
`;

const StyledSelectOption = styled.div<StyledSelectOptionProps>`
  padding: 13px;
  cursor: pointer;
  ${({ theme, selectedValue, typeDesign }) =>
    selectedValue
      ? typeDesign === 'form' || typeDesign === 'navbar'
        ? `
        color: ${theme.colors.dvt.text.help};
        background: ${theme.colors.dvt.primary.light2};
      `
        : `
        color: ${theme.colors.grayscale.light5};
        background: ${theme.colors.dvt.primary.light1};
      `
      : typeDesign === 'form' || typeDesign === 'navbar'
      ? `
        color: ${theme.colors.dvt.primary.light1};
        background: ${theme.colors.dvt.primary.light3};
      }
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
  border-radius: ${({ itemLength, typeDesign }) =>
    itemLength > 6 ? '12px 0 0 12px' : typeDesign === 'form' ? '4px' : '12px'};
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
const StyledSelectIcon = styled.div<StyledSelectIconProps>`
  position: absolute;
  right: 12px;
  transition: transform 0.3s ease-in-out;
  transform: ${({ isOpen }) => (isOpen ? 'rotate(90deg)' : 'none')};
`;

const StyledSelectPopover = styled.div`
  display: flex;
  gap: 8px;
`;

export {
  StyledSelect,
  StyledSelectOption,
  StyledSelectLabel,
  StyledSelectSelect,
  StyledSelectIcon,
  StyledSelectOptions,
  StyledSelectPopover,
};
