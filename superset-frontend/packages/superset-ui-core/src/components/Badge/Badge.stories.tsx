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
import { Badge } from '.';
import type { BadgeProps } from './types';

export default {
  title: 'Components/Badge',
  component: Badge,
};

type BadgeColor = Pick<BadgeProps, 'color'>;
type BadgeColorValue = BadgeColor[keyof BadgeColor];
type BadgeSize = Pick<BadgeProps, 'size'>;
type BadgeSizeValue = BadgeSize[keyof BadgeSize];

const badgeColors: BadgeColorValue[] = [
  'pink',
  'red',
  'yellow',
  'orange',
  'cyan',
  'green',
  'blue',
  'purple',
  'geekblue',
  'magenta',
  'volcano',
  'gold',
  'lime',
];
const badgeSizes: BadgeSizeValue[] = ['default', 'small'];
const STATUSES = ['default', 'error', 'warning', 'success', 'processing'];

const COLORS = {
  label: 'colors',
  options: badgeColors,
  defaultValue: undefined,
};

const SIZES = {
  label: 'sizes',
  options: badgeSizes,
  defaultValue: undefined,
};

// Count Badge - shows a number
export const InteractiveBadge = (args: BadgeProps) => (
  <Badge {...args}>
    <div
      style={{
        width: 40,
        height: 40,
        background: '#eee',
        borderRadius: 4,
      }}
    />
  </Badge>
);

InteractiveBadge.args = {
  count: 5,
  size: 'default',
  showZero: false,
  overflowCount: 99,
};

InteractiveBadge.argTypes = {
  count: {
    description: 'Number to show in the badge.',
    control: { type: 'number' },
  },
  size: {
    description: 'Size of the badge.',
    control: { type: 'select' },
    options: ['default', 'small'],
  },
  color: {
    description: 'Custom background color for the badge.',
    control: { type: 'select' },
    options: [
      'pink',
      'red',
      'yellow',
      'orange',
      'cyan',
      'green',
      'blue',
      'purple',
      'geekblue',
      'magenta',
      'volcano',
      'gold',
      'lime',
    ],
  },
  showZero: {
    description: 'Whether to show badge when count is zero.',
    control: 'boolean',
  },
  overflowCount: {
    description:
      'Max count to show. Shows count+ when exceeded (e.g., 99+).',
    control: 'number',
  },
};

// Status Badge - shows a status dot with text
export const StatusBadge = (args: BadgeProps) => <Badge {...args} />;

StatusBadge.args = {
  status: 'success',
  text: 'Completed',
};

StatusBadge.argTypes = {
  status: {
    description: 'Status type for the badge dot.',
    control: { type: 'select' },
    options: ['default', 'error', 'warning', 'success', 'processing'],
  },
  text: {
    description: 'Text to display next to the status dot.',
    control: { type: 'text' },
  },
};

export const BadgeGallery = () => (
  <>
    {SIZES.options.map(size => (
      <div key={size} style={{ marginBottom: 40 }}>
        <h4>{size}</h4>
        <div style={{ display: 'flex', gap: 24 }}>
          {COLORS.options.map(color => (
            <Badge
              count={9}
              color={color}
              size={size}
              key={`${color}_${size}`}
            />
          ))}
        </div>
      </div>
    ))}
  </>
);

BadgeGallery.parameters = {
  actions: {
    disable: true,
  },
  controls: {
    disable: true,
  },
};
