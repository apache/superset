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
import Icon from '../Icons/Icon';
import {
  StyledDropdown,
  StyledDropdownOpen,
  StyledDropdownLabel,
  DropdownMenu,
  DropdownOption,
  StyledDropdownGroup,
} from './dvt-dropdown.module';

export interface OptionProps {
  label: string;
  icon?: string;
  onClick: (item: any) => void;
}

export interface DvtDropdownProps {
  data: OptionProps[];
  icon?: string;
  item?: any;
  direction?: 'left' | 'right';
  label?: string;
}

const DvtDropdown: React.FC<DvtDropdownProps> = ({
  data,
  icon,
  item = {},
  direction = 'right',
  label = '',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(ref, () => setIsOpen(false));

  return (
    <StyledDropdownGroup>
      <StyledDropdownOpen onClick={() => setIsOpen(!isOpen)}>
        {!icon ? (
          <StyledDropdownLabel>{label}</StyledDropdownLabel>
        ) : (
          <Icon fileName={icon} iconSize="xl" />
        )}
      </StyledDropdownOpen>
      <StyledDropdown ref={ref} direction={direction}>
        {isOpen && (
          <DropdownMenu>
            {data.map((data, index) => (
              <DropdownOption
                key={index}
                onClick={() => {
                  data.onClick(item);
                  setIsOpen(false);
                }}
              >
                {data.icon && <Icon fileName={data.icon} />}
                {data.label}
              </DropdownOption>
            ))}
          </DropdownMenu>
        )}
      </StyledDropdown>
    </StyledDropdownGroup>
  );
};

export default DvtDropdown;
