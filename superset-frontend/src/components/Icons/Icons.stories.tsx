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
import React from 'react';
import { styled, supersetTheme } from '@superset-ui/core';
import Icons from '.';
import IconType from './IconType';
import Icon from './Icon';

export default {
  title: 'Icons',
  component: Icon,
};

const palette = { Default: null };
Object.entries(supersetTheme.colors).forEach(([familyName, family]) => {
  Object.entries(family).forEach(([colorName, colorValue]) => {
    palette[`${familyName} / ${colorName}`] = colorValue;
  });
});

const IconSet = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, 200px);
  grid-auto-rows: 100px;
`;

const IconBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
`;

export const InteractiveIcons = ({
  showNames,
  ...rest
}: IconType & { showNames: boolean }) => (
  <IconSet>
    {Object.keys(Icons).map(k => {
      const IconComponent = Icons[k];
      return (
        <IconBlock key={k}>
          <IconComponent {...rest} />
          {showNames && k}
        </IconBlock>
      );
    })}
  </IconSet>
);

InteractiveIcons.argTypes = {
  showNames: {
    name: 'Show names',
    defaultValue: true,
    control: { type: 'boolean' },
  },
  iconSize: {
    defaultValue: 'xl',
    control: { type: 'inline-radio', options: ['s', 'l', 'm', 'xl', 'xxl'] },
  },
  iconColor: {
    defaultValue: null,
    control: { type: 'select', options: palette },
  },
  // @TODO twoToneColor is being ignored
  twoToneColor: {
    defaultValue: null,
    control: { type: 'select', options: palette },
  },
  theme: {
    table: {
      disable: true,
    },
  },
};

InteractiveIcons.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
