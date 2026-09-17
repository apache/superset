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
import { Input } from 'antd-v5';
import Icons from '.';
import IconType from './IconType';
import Icon from './Icon';

export default {
  title: 'Icons',
  component: Icon,
};

const palette: Record<string, string | null> = { Default: null };
Object.entries(supersetTheme.colors).forEach(([familyName, family]) => {
  Object.entries(family).forEach(([colorName, colorValue]) => {
    palette[`${familyName} / ${colorName}`] = colorValue;
  });
});

const IconSet = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, 180px);
  grid-auto-rows: 90px;
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
`;

const IconBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.gridUnit * 2}px;

  span {
    margin-top: ${({ theme }) =>
      2 * theme.gridUnit}px; // Add spacing between icon and name
    font-size: ${({ theme }) =>
      theme.typography.sizes.s}; // Optional: adjust font size for elegance
    color: ${({ theme }) =>
      theme.colors.grayscale.base}; // Optional: subtle color for the name
  }
`;

const SearchBox = styled(Input.Search)`
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
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
          const IconComponent = Icons[k];
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
    options: ['s', 'l', 'm', 'xl', 'xxl'],
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
