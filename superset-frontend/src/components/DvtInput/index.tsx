import React, { useState } from 'react';
import { supersetTheme } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import {
  StyledInput,
  StyledInputField,
  StyledInputPasswordIcon,
} from './dvt-input.module';

export interface DvtInputProps {
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'search';
  value: string;
  onChange: (value: string) => void;
  handleSearchClick: () => void;
}

const DvtInput = ({
  placeholder = '',
  type = 'text',
  value,
  onChange,
  handleSearchClick,
}: DvtInputProps) => {
  const [show, setShow] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <StyledInput>
      {type === 'email' && (
        <Icon
          fileName="email"
          iconSize="xl"
          iconColor={supersetTheme.colors.dvt.text.label}
          style={{ paddingRight: '12px' }}
        />
      )}
      {type === 'password' && (
        <Icon
          fileName="lock_locked"
          iconSize="xl"
          iconColor={supersetTheme.colors.dvt.text.label}
          style={{ paddingRight: '12px' }}
        />
      )}
      <StyledInputField
        placeholder={placeholder}
        type={show ? 'text' : type}
        value={value}
        onChange={handleChange}
      ></StyledInputField>
      {type === 'password' && (
        <StyledInputPasswordIcon onClick={() => setShow(!show)}>
          <Icon
            fileName={show ? 'eye_slash' : 'eye'}
            iconSize="xl"
            iconColor={supersetTheme.colors.dvt.text.label}
          />
        </StyledInputPasswordIcon>
      )}
      {type === 'search' && (
        <StyledInputPasswordIcon onClick={() => handleSearchClick()}>
          <Icon
            fileName="search"
            iconSize="xl"
            iconColor={supersetTheme.colors.dvt.text.label}
          />
        </StyledInputPasswordIcon>
      )}
    </StyledInput>
  );
};

export default DvtInput;
