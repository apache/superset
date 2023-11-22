import React, { useState } from 'react';
import Icon from '../Icons/Icon';
import {
  StyledSelect,
  StyledSelectOption,
  StyledSelectOptions,
  StyledSelectLabel,
  StyledSelectSelect,
  StyledSelectIcon,
} from './dvt-select.module';

export interface DvtSelectProps {
  label: string;
  data: { value: string; label: string }[];
  placeholder: string;
  selectedValue: string;
  setSelectedValue: (newSeletedValue: string) => void;
}

const DvtSelect: React.FC<DvtSelectProps> = ({
  data,
  label,
  selectedValue,
  setSelectedValue,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectClick = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (value: string) => {
    setSelectedValue(value);
    setIsOpen(false);
  };

  return (
    <StyledSelect onClick={handleSelectClick}>
      <StyledSelectLabel>{label}</StyledSelectLabel>
      <StyledSelectSelect isOpen={isOpen}>
        {selectedValue}
        <StyledSelectIcon>
          {isOpen && (
            <Icon fileName="caret_down" iconSize="xxl" iconColor="black" />
          )}

          {!isOpen && (
            <Icon fileName="caret_right" iconSize="xxl" iconColor="black" />
          )}
        </StyledSelectIcon>
      </StyledSelectSelect>

      {isOpen && (
        <StyledSelectOptions>
          {data.map(option => (
            <StyledSelectOption
              key={option.value}
              onClick={() => handleOptionClick(option.label)}
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
