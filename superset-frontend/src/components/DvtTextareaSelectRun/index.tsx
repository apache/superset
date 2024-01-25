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
import React, { useState } from 'react';
import DvtButton from '../DvtButton';
import Icon from '../Icons/Icon';
import {
  StyledDvtTextarea,
  StyledDvtTextareaSelectRun,
  StyledDvtTextareaLimit,
  StyledDvtTextareaButton,
  StyledDvtTextareaGroup,
  StyledDvtTextareaDropdown,
  StyledDvtTextareaDropdownItem,
  StyledDvtTextareaIcon,
} from './dvt-textarea-select-run.module';

export interface DvtTextareaSelectRunProps {
  limit: number;
  setLimit: (newLimit: number) => void;
  clickRun: () => void;
  placeholder?: string;
  value: string;
  setValue: (newValue: string) => void;
}

const DvtTextareaSelectRun: React.FC<DvtTextareaSelectRunProps> = ({
  limit,
  setLimit,
  clickRun,
  placeholder = '',
  value,
  setValue,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const limitData = [10, 100, 1000, 10000, 100000];

  const handleDropdownClick = (value: number) => {
    setLimit(value);
    setIsOpen(false);
  };
  const handleIsOpen = () => {
    setIsOpen(!isOpen);
  };
  return (
    <StyledDvtTextareaSelectRun>
      <StyledDvtTextarea
        placeholder={placeholder}
        value={value}
        onChange={event => setValue(event.target.value)}
      />
      <StyledDvtTextareaGroup>
        <StyledDvtTextareaLimit onClick={handleIsOpen}>
          LIMIT:
          {limit.toString().length > 3
            ? `${limit.toString().slice(0, -3)} 000`
            : limit}
          <StyledDvtTextareaIcon isOpen={isOpen}>
            <Icon fileName="caret_right" iconSize="xxl" iconColor="black" />
          </StyledDvtTextareaIcon>
          {isOpen && (
            <StyledDvtTextareaDropdown>
              {limitData.map((option, index) => (
                <StyledDvtTextareaDropdownItem
                  key={index}
                  onClick={() => handleDropdownClick(option)}
                  selectedItem={limit}
                  Item={option}
                >
                  {option.toString().length > 3
                    ? `${option.toString().slice(0, -3)} 000`
                    : option}
                </StyledDvtTextareaDropdownItem>
              ))}
            </StyledDvtTextareaDropdown>
          )}
        </StyledDvtTextareaLimit>
        <StyledDvtTextareaButton>
          <DvtButton label="Run" onClick={clickRun} maxWidth />
        </StyledDvtTextareaButton>
      </StyledDvtTextareaGroup>
    </StyledDvtTextareaSelectRun>
  );
};

export default DvtTextareaSelectRun;
