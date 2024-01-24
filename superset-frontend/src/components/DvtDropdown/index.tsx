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
  DropdownMenu,
  DropdownOption,
  StyledDropdownGroup,
} from './dvt-dropdown.module';

export interface OptionProps {
  label: string;
  icon?: string;
  onClick: (id: number) => void;
}

export interface DvtDropdownProps {
  data: OptionProps[];
  icon: string;
  id?: number;
}

const DvtDropdown: React.FC<DvtDropdownProps> = ({ data, icon, id = 0 }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(ref, () => setIsOpen(false));

  return (
    <StyledDropdownGroup>
      <Icon fileName={icon} iconSize="xl" onClick={() => setIsOpen(!isOpen)} />
      <StyledDropdown ref={ref}>
        {isOpen && (
          <DropdownMenu>
            {data.map((item, index) => (
              <DropdownOption
                key={index}
                onClick={() => {
                  item.onClick(id);
                  setIsOpen(false);
                }}
              >
                {item.icon && <Icon fileName={item.icon} />}
                {item.label}
              </DropdownOption>
            ))}
          </DropdownMenu>
        )}
      </StyledDropdown>
    </StyledDropdownGroup>
  );
};
export default DvtDropdown;
