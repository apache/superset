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
import { Divider } from '.';
import type { DividerProps } from './types';

export default {
  title: 'Components/Divider',
  component: Divider,
};

export const InteractiveDivider = (args: DividerProps) => <Divider {...args} />;

InteractiveDivider.args = {
  dashed: false,
  variant: 'solid',
  orientation: 'center',
  orientationMargin: '',
  plain: true,
  type: 'horizontal',
};

InteractiveDivider.argTypes = {
  variant: {
    control: { type: 'select' },
    options: ['dashed', 'dotted', 'solid'],
    description: 'Line style of the divider.',
  },
  orientation: {
    control: { type: 'select' },
    options: ['left', 'right', 'center'],
    description: 'Position of title inside divider.',
  },
  orientationMargin: {
    control: { type: 'text' },
    description: 'Margin from divider edge to title.',
  },
  type: {
    control: { type: 'select' },
    options: ['horizontal', 'vertical'],
    description: 'Direction of the divider.',
  },
  dashed: {
    description: 'Whether line is dashed (deprecated, use variant).',
  },
  plain: {
    description: 'Use plain style without bold title.',
  },
};

InteractiveDivider.parameters = {
  actions: {
    disable: true,
  },
  docs: {
    description: {
      story:
        'A divider line to separate content. Use horizontal for sections, vertical for inline elements.',
    },
    liveExample: `function Demo() {
  return (
    <>
      <p>Horizontal divider with title (orientationMargin applies here):</p>
      <Divider orientation="left" orientationMargin={0}>Left Title</Divider>
      <Divider orientation="right" orientationMargin={50}>Right Title</Divider>
      <Divider>Center Title</Divider>
      <p>Vertical divider (use container gap for spacing):</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span>Link</span>
        <Divider type="vertical" />
        <span>Link</span>
        <Divider type="vertical" />
        <span>Link</span>
      </div>
    </>
  );
}`,
  },
};
