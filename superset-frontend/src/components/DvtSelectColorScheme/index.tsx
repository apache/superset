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
import { SupersetTheme } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import DvtPopper from '../DvtPopper';
import { DvtSchemeColorData } from './dvtSchemeColorData';
import {
  StyledSelectColorScheme,
  StyledSelectColorSchemeOption,
  StyledSelectColorSchemeOptions,
  StyledSelectColorSchemeLabel,
  StyledSelectColorSchemeSelect,
  StyledSelectColorSchemeIcon,
  StyledSelectColorSchemePopover,
  StyledSelectColors,
  StyledSelectColor,
  StyledSelectColorsLabel,
} from './dvt-select-color-scheme.module';

export interface DvtSelectColorSchemeProps {
  label?: string;
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

const DvtSelectColorScheme: React.FC<DvtSelectColorSchemeProps> = ({
  label = '',
  placeholder = '',
  selectedValue = {},
  setSelectedValue,
  typeDesign = 'normal',
  width = 350,
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
    <StyledSelectColorScheme
      ref={ref}
      typeDesign={typeDesign}
      style={{ minWidth: maxWidth ? '100%' : width }}
    >
      <StyledSelectColorSchemePopover>
        {label && (
          <StyledSelectColorSchemeLabel typeDesign={typeDesign}>
            {label}
          </StyledSelectColorSchemeLabel>
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
      </StyledSelectColorSchemePopover>
      <StyledSelectColorSchemeSelect
        isOpen={isOpen}
        onClick={handleSelectClick}
        typeDesign={typeDesign}
        selectedValue={selectedValue[objectName]}
      >
        {selectedValue[objectName] || placeholder}
        <StyledSelectColorSchemeIcon isOpen={isOpen}>
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
        </StyledSelectColorSchemeIcon>
      </StyledSelectColorSchemeSelect>
      {isOpen && (
        <StyledSelectColorSchemeOptions
          isOpen={isOpen}
          label={label || ''}
          itemLength={DvtSchemeColorData.length}
          typeDesign={typeDesign}
        >
          {DvtSchemeColorData.map((option, index) => (
            <StyledSelectColorSchemeOption
              selectedValue={option[objectName] === selectedValue[objectName]}
              key={index}
              onClick={() => handleOptionClick(option)}
              typeDesign={typeDesign}
            >
              <StyledSelectColorsLabel>
                {option[objectName]}
              </StyledSelectColorsLabel>
              <StyledSelectColors>
                {option.colors.map((color, colorIndex) => (
                  <StyledSelectColor key={colorIndex} color={color} />
                ))}
              </StyledSelectColors>
            </StyledSelectColorSchemeOption>
          ))}
        </StyledSelectColorSchemeOptions>
      )}
    </StyledSelectColorScheme>
  );
};

export default DvtSelectColorScheme;
