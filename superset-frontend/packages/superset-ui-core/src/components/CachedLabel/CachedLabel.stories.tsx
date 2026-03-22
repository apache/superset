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
import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { CachedLabel } from '.';
import type { CacheLabelProps } from './types';

export default {
  title: 'Components/CachedLabel',
  component: CachedLabel,
} as Meta<typeof CachedLabel>;

// Interactive CachedLabel story
export const InteractiveCachedLabel: StoryFn<CacheLabelProps> = args => (
  <div style={{ display: 'inline-block' }}>
    <CachedLabel {...args} />
  </div>
);

InteractiveCachedLabel.args = {
  cachedTimestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
  onClick: action('refresh-clicked'),
};

InteractiveCachedLabel.argTypes = {
  cachedTimestamp: {
    description: 'ISO timestamp of when the data was cached',
    control: { type: 'text' },
  },
  className: {
    description: 'Additional CSS class for the label',
    control: { type: 'text' },
  },
};

// Show different cache ages
export const CacheAges: StoryFn = () => {
  const now = Date.now();
  const timestamps = [
    { label: 'Just now', timestamp: new Date(now - 30 * 1000).toISOString() },
    {
      label: '5 minutes ago',
      timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
    },
    {
      label: '1 hour ago',
      timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
    },
    {
      label: '1 day ago',
      timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    },
    { label: 'No timestamp', timestamp: undefined },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {timestamps.map(({ label, timestamp }) => (
        <div
          key={label}
          style={{ display: 'flex', alignItems: 'center', gap: 16 }}
        >
          <span style={{ width: 120, color: '#666' }}>{label}:</span>
          <CachedLabel
            cachedTimestamp={timestamp}
            onClick={action('refresh-clicked')}
          />
        </div>
      ))}
      <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
        Hover over each label to see the tooltip with relative time
      </p>
    </div>
  );
};

CacheAges.parameters = {
  docs: {
    description: {
      story:
        'Shows the CachedLabel with different cache timestamps. Hover to see the relative time in the tooltip.',
    },
  },
};
