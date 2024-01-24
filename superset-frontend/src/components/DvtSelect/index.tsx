/* eslint-disable translation-vars/no-template-vars */
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
import useOnClickOutside from 'src/hooks/useOnClickOutsite';
import { SupersetTheme, t } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import DvtPopper from '../DvtPopper';
import {
  StyledSelect,
  StyledSelectOption,
  StyledSelectOptions,
  StyledSelectLabel,
  StyledSelectSelect,
  StyledSelectIcon,
  StyledSelectPopover,
} from './dvt-select.module';

export interface DvtSelectProps {
  label?: string;
  data: any[];
  placeholder?: string;
  selectedValue: any;
  setSelectedValue: (newSeletedValue: any) => void;
  typeDesign?: 'normal' | 'form' | 'navbar';
  width?: number;
  maxWidth?: boolean;
  popoverLabel?: string;
  popoverDirection?: 'top' | 'bottom' | 'left' | 'right';
  important?: boolean;
  importantLabel?: string;
  objectName?: string;
}

const DvtSelect: React.FC<DvtSelectProps> = ({
  data,
  label = '',
  placeholder = '',
  selectedValue = {},
  setSelectedValue,
  typeDesign = 'normal',
  width = 202,
  maxWidth = false,
  popoverDirection = 'top',
  popoverLabel,
  important,
  importantLabel = 'Cannot be empty',
  objectName = 'label',
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  useOnClickOutside(ref, () => setIsOpen(false));

  const handleSelectClick = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (value: any) => {
    setSelectedValue(value);
    setIsOpen(false);
  };

  return (
    <StyledSelect
      ref={ref}
      typeDesign={typeDesign}
      style={{ minWidth: maxWidth ? '100%' : width }}
    >
      <StyledSelectPopover>
        {label && (
          <StyledSelectLabel typeDesign={typeDesign}>
            {label && t(`${label}`)}
          </StyledSelectLabel>
        )}
        {important && !selectedValue[objectName] && (
          <DvtPopper
            size="small"
            label={importantLabel}
            direction={popoverDirection}
          >
            <Icon
              fileName="warning"
              css={(theme: SupersetTheme) => ({
                color: theme.colors.alert.base,
              })}
              iconSize="l"
            />
          </DvtPopper>
        )}
        {popoverLabel && (
          <DvtPopper
            size="small"
            label={popoverLabel}
            direction={popoverDirection}
          >
            <Icon
              fileName="warning"
              css={(theme: SupersetTheme) => ({
                color: theme.colors.dvt.primary.base,
              })}
              iconSize="l"
            />
          </DvtPopper>
        )}
      </StyledSelectPopover>
      <StyledSelectSelect
        isOpen={isOpen}
        onClick={handleSelectClick}
        typeDesign={typeDesign}
        selectedValue={selectedValue[objectName]}
      >
        {selectedValue[objectName] || t(`${placeholder}`)}
        <StyledSelectIcon isOpen={isOpen}>
          <Icon
            fileName="caret_right"
            iconSize="xxl"
            css={(theme: SupersetTheme) => ({
              color:
                typeDesign === 'form' || typeDesign === 'navbar'
                  ? theme.colors.dvt.text.label
                  : theme.colors.grayscale.dark2,
            })}
          />
        </StyledSelectIcon>
      </StyledSelectSelect>
      {isOpen && (
        <StyledSelectOptions
          isOpen={isOpen}
          label={label || ''}
          itemLength={data.length}
          typeDesign={typeDesign}
        >
          {data.map((option, index) => (
            <StyledSelectOption
              selectedValue={option[objectName] === selectedValue[objectName]}
              key={index}
              onClick={() => handleOptionClick(option)}
              typeDesign={typeDesign}
            >
              {option[objectName]}
            </StyledSelectOption>
          ))}
        </StyledSelectOptions>
      )}
    </StyledSelect>
  );
};

export default DvtSelect;
