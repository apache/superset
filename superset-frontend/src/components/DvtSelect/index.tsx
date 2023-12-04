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
import React, { useRef, useState } from 'react';
import Icon from '../Icons/Icon';
import {
  StyledSelect,
  StyledSelectOption,
  StyledSelectOptions,
  StyledSelectLabel,
  StyledSelectSelect,
  StyledSelectIcon,
} from './dvt-select.module';
import useOnClickOutside from 'src/hooks/useOnClickOutsite';

export interface DvtSelectProps {
  label?: string;
  data: { value: string; label: string }[];
  placeholder?: string;
  selectedValue: string;
  setSelectedValue: (newSeletedValue: string) => void;
}

const DvtSelect: React.FC<DvtSelectProps> = ({
  data,
  label,
  placeholder,
  selectedValue,
  setSelectedValue,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  useOnClickOutside(ref, () => setIsOpen(false));

  const handleSelectClick = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (value: string) => {
    setSelectedValue(value);
    setIsOpen(false);
  };

  return (
    <StyledSelect ref={ref} onClick={handleSelectClick}>
      {label && <StyledSelectLabel>{label}</StyledSelectLabel>}
      <StyledSelectSelect isOpen={isOpen}>
        {data.find(option => option.value === selectedValue)?.label ||
          placeholder}
        <StyledSelectIcon isOpen={isOpen}>
          <Icon fileName="caret_right" iconSize="xxl" iconColor="black" />
        </StyledSelectIcon>
      </StyledSelectSelect>

      {isOpen && (
        <StyledSelectOptions
          isOpen={isOpen}
          label={label || ''}
          itemLength={data.length}
        >
          {data.map((option, index) => (
            <StyledSelectOption
              selectedValue={selectedValue}
              value={option.value}
              key={index}
              onClick={() => handleOptionClick(option.value)}
            >
              {option.label}
            </StyledSelectOption>
          ))}
        </StyledSelectOptions>
      )}
    </StyledSelect>
  );
};

export default DvtSelect;
