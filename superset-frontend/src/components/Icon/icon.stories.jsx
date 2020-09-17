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
import { withKnobs, select } from '@storybook/addon-knobs';
import { styled, supersetTheme } from '@superset-ui/core';
import Icon, { iconsRegistry } from '.';

export default {
  title: 'Icon',
  component: Icon,
  decorators: [withKnobs],
};

const palette = {};
Object.entries(supersetTheme.colors).forEach(([familyName, family]) => {
  Object.entries(family).forEach(([colorName, colorValue]) => {
    palette[`${familyName} / ${colorName}`] = colorValue;
  });
});

const colorKnob = {
  label: 'Color',
  options: {
    Default: null,
    ...palette,
  },
  defaultValue: null,
};

const IconSet = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`;

const IconBlock = styled.div`
  flex-grow: 0;
  flex-shrink: 0;
  flex-basis: 10%;
  text-align: center;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  div {
    white-space: nowrap;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
  }
`;

export const SupersetIcon = () => {
  return (
    <IconSet>
      {Object.keys(iconsRegistry)
        .sort()
        .map(iconName => (
          <IconBlock>
            <Icon
              name={iconName}
              key={iconName}
              color={select(
                colorKnob.label,
                colorKnob.options,
                colorKnob.defaultValue,
                colorKnob.groupId,
              )}
            />
            <div>{iconName}</div>
          </IconBlock>
        ))}
    </IconSet>
  );
};
