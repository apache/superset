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
import { useState } from 'react';
import { styled, supersetTheme } from '@superset-ui/core';
import { Input } from '../Input';
import { Icons, IconNameType } from '.';
import type { IconType } from './types';
import { BaseIconComponent } from './BaseIcon';

export default {
  title: 'Components/Icons',
  component: BaseIconComponent,
};

const palette: Record<string, string | null> = {
  Default: null,
  Primary: supersetTheme.colorPrimary,
  Success: supersetTheme.colorSuccess,
  Warning: supersetTheme.colorWarning,
  Error: supersetTheme.colorError,
  Info: supersetTheme.colorInfo,
  Text: supersetTheme.colorText,
  'Text Secondary': supersetTheme.colorTextSecondary,
  Icon: supersetTheme.colorIcon,
};

const IconSet = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, 180px);
  grid-auto-rows: 90px;
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const IconBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;

  span {
    margin-top: ${({ theme }) =>
      2 * theme.sizeUnit}px; // Add spacing between icon and name
    font-size: ${({ theme }) =>
      theme.fontSizeSM}; // Optional: adjust font size for elegance
    color: ${({ theme }) =>
      theme.colorText}; // Optional: subtle color for the name
  }
`;

const SearchBox = styled(Input.Search)`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  width: 100%;
  max-width: 400px;
`;

export const InteractiveIcons = ({
  showNames = true,
  ...rest
}: IconType & { showNames: boolean }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter icons based on the search term
  const filteredIcons = Object.keys(Icons).filter(k =>
    k.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div>
      <SearchBox
        placeholder="Search icons..."
        onChange={e => setSearchTerm(e.target.value)}
        allowClear
      />
      <IconSet>
        {filteredIcons.map(k => {
          const IconComponent = Icons[k as IconNameType];
          return (
            <IconBlock key={k}>
              <IconComponent {...rest} />
              {showNames && <span>{k}</span>}
            </IconBlock>
          );
        })}
      </IconSet>
    </div>
  );
};

InteractiveIcons.argTypes = {
  showNames: {
    name: 'Show names',
    defaultValue: true,
    control: { type: 'boolean' },
  },
  iconSize: {
    defaultValue: 'xl',
    control: { type: 'inline-radio' },
    options: ['s', 'm', 'l', 'xl', 'xxl'],
  },
  iconColor: {
    defaultValue: null,
    control: { type: 'select' },
    options: palette,
  },
  theme: {
    table: {
      disable: true,
    },
  },
};
