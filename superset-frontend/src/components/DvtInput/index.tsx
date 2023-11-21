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
import { supersetTheme } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import {
  StyledInput,
  StyledInputField,
  StyledInputIcon,
} from './dvt-input.module';

export interface DvtInputProps {
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'search';
  size?: 'small' | 'medium' | 'large';
  value: string;
  onChange: (value: string) => void;
  handleSearchClick?: () => void;
}

const DvtInput = ({
  placeholder = '',
  type = 'text',
  size = 'medium',
  value,
  onChange,
  handleSearchClick,
}: DvtInputProps) => {
  const [show, setShow] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <StyledInput $size={size}>
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
      />
      {type === 'password' && (
        <StyledInputIcon onClick={() => setShow(!show)}>
          <Icon
            fileName={show ? 'eye' : 'eye_slash'}
            iconSize="xl"
            iconColor={supersetTheme.colors.dvt.text.label}
          />
        </StyledInputIcon>
      )}
      {type === 'search' && (
        <StyledInputIcon onClick={() => handleSearchClick && handleSearchClick}>
          <Icon
            fileName="search"
            iconSize="xl"
            iconColor={supersetTheme.colors.dvt.text.label}
          />
        </StyledInputIcon>
      )}
    </StyledInput>
  );
};

export default DvtInput;
