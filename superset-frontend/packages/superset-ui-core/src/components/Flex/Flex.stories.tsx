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

import { css } from '@apache-superset/core/ui';
import { Flex } from '.';
import type { FlexProps } from './types';

export default {
  title: 'Design System/Components/Flex',
  component: Flex,
};

// Sample children used in both Storybook and auto-generated docs
const SAMPLE_ITEMS = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'];

// Shared styling for sample items - matches docs site rendering
const sampleItemStyle = {
  padding: '8px 16px',
  background: '#e6f4ff',
  border: '1px solid #91caff',
  borderRadius: '4px',
};

export const InteractiveFlex = (args: FlexProps) => (
  <Flex
    {...args}
    css={css`
      width: 100%;
      height: 90vh;
    `}
  >
    {SAMPLE_ITEMS.map((item, i) => (
      <div key={i} style={sampleItemStyle}>
        {item}
      </div>
    ))}
  </Flex>
);

InteractiveFlex.args = {
  vertical: false,
  wrap: 'nowrap',
  justify: 'normal',
  align: 'normal',
  flex: 'normal',
  gap: 'small',
};

InteractiveFlex.argTypes = {
  vertical: {
    control: { type: 'boolean' },
    type: { name: 'boolean', required: false },
  },
  wrap: {
    control: { type: 'select' },
    options: ['nowrap', 'wrap', 'wrap-reverse', false, true],
    type: { name: 'string', required: false },
  },
  justify: {
    control: { type: 'select' },
    options: [
      'start',
      'center',
      'space-between',
      'space-around',
      'space-evenly',
    ],
    type: { name: 'string', required: false },
  },
  align: {
    control: { type: 'select' },
    options: ['start', 'center', 'end', 'stretch'],
    type: { name: 'string', required: false },
  },
  flex: {
    control: { type: 'string' },
    type: { name: 'string', required: false },
  },
  gap: {
    control: { type: 'select' },
    options: ['small', 'medium', 'large'],
    type: { name: 'string', required: false },
  },
};

// Sample children for documentation - references the same data and styling used in render
InteractiveFlex.parameters = {
  docs: {
    sampleChildren: SAMPLE_ITEMS,
    sampleChildrenStyle: sampleItemStyle,
  },
};
