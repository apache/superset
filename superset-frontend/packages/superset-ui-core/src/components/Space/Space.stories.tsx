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
import { Space, type SpaceProps } from '.';

export default {
  title: 'Design System/Components/Space',
  component: Space,
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

export const InteractiveSpace = (args: SpaceProps) => (
  <Space {...args}>
    {SAMPLE_ITEMS.map((item, i) => (
      <div key={i} style={sampleItemStyle}>
        {item}
      </div>
    ))}
  </Space>
);

InteractiveSpace.args = {
  direction: 'horizontal',
  size: 'small',
  wrap: false,
};

InteractiveSpace.argTypes = {
  align: {
    control: { type: 'select' },
    options: ['start', 'end', 'center', 'baseline', ''],
  },
  direction: {
    control: { type: 'select' },
    options: ['vertical', 'horizontal'],
  },
  size: {
    control: { type: 'select' },
    options: ['small', 'middle', 'large'],
  },
};

// Sample children for documentation - references the same data and styling used in render
InteractiveSpace.parameters = {
  docs: {
    sampleChildren: SAMPLE_ITEMS,
    sampleChildrenStyle: sampleItemStyle,
  },
};
