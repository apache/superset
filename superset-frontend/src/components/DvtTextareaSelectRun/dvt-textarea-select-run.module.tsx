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
const dropdownKeyframes = keyframes`
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
`;

interface StyledDvtTextareaIconProps {
  isOpen: boolean;
}
interface StyledDvtTextareaItemProps {
  selectedItem: number;
  Item: number;
}

const StyledDvtTextareaSelectRun = styled.div`
  width: 1126px;
  height: 281px;
  border-radius: 12px;
`;

const StyledDvtTextarea = styled.textarea`
  width: 1066px;
  height: 187px;
  border: none;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  color: ${({ theme }) => theme.colors.dvt.text.help};
  resize: none;
  margin: 30px 30px 0 30px;
  &:focus {
    outline: none;
  }
`;

const StyledDvtTextareaLimit = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
`;
const StyledDvtTextareaLimitInput = styled.div`
  position: relative;
  background: ${({ theme }) => theme.colors.grayscale.light5};
`;
const StyledDvtTextareaButton = styled.div`
  width: 110px;
  margin-left: 20px;
`;

const StyledDvtTextareaGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 16px;
  font-weight: 500;
  margin-right: 20px;
`;

const StyledDvtTextareaDropdown = styled.div`
  position: absolute;
  top: 35px;
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.colors.dvt.primary.light2};
  max-width: 145px;
  animation: ${dropdownKeyframes} 0.3s ease-in-out;
  transform-origin: top;
`;

const StyledDvtTextareaDropdownItem = styled.div<StyledDvtTextareaItemProps>`
  padding: 5px;
  cursor: pointer;

  ${({ theme, Item, selectedItem }) =>
    Item === selectedItem
      ? `
      color: ${theme.colors.grayscale.light5};
      background: ${theme.colors.dvt.text.help};
      `
      : `
      color: ${theme.colors.dvt.text.help};
      background: ${theme.colors.grayscale.light5};
      }
    `}
`;

const StyledDvtTextareaIcon = styled.div<StyledDvtTextareaIconProps>`
  transition: transform 0.3s ease-in-out;
  transform: ${({ isOpen }) => (isOpen ? 'rotate(90deg)' : 'none')};
`;

export {
  StyledDvtTextarea,
  StyledDvtTextareaSelectRun,
  StyledDvtTextareaLimit,
  StyledDvtTextareaLimitInput,
  StyledDvtTextareaButton,
  StyledDvtTextareaGroup,
  StyledDvtTextareaDropdown,
  StyledDvtTextareaDropdownItem,
  StyledDvtTextareaIcon,
};
