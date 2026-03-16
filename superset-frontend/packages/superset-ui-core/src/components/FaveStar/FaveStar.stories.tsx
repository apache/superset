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
import type { Meta, StoryObj } from '@storybook/react';
import { FaveStar } from '.';

export default {
  title: 'Components/FaveStar',
  component: FaveStar,
  argTypes: {
    itemId: {
      control: false,
      description: 'Unique identifier for the item',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    isStarred: {
      control: 'boolean',
      description: 'Indicates if the item is starred',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    showTooltip: {
      control: 'boolean',
      description: 'Show tooltip on hover',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    fetchFaveStar: {
      table: {
        disable: true,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'FaveStar component for marking items as favorites',
      },
    },
  },
} as Meta<typeof FaveStar>;

type Story = StoryObj<typeof FaveStar>;

export const Default: Story = {
  render: args => (
    <div style={{ margin: '0 auto' }}>
      <FaveStar {...args} />
    </div>
  ),
};

export const InteractiveFaveStar: Story = {
  args: {
    itemId: 1,
    isStarred: false,
    showTooltip: true,
    saveFaveStar: () => {},
  },
  argTypes: {
    isStarred: {
      control: 'boolean',
      description: 'Whether the item is currently starred.',
    },
    showTooltip: {
      control: 'boolean',
      description: 'Show tooltip on hover.',
    },
  },
  render: args => (
    <span style={{ display: 'inline-block' }}>
      <FaveStar {...args} />
    </span>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A star icon for marking items as favorites.',
      },
      liveExample: `function Demo() {
  const [starred, setStarred] = React.useState(false);
  const toggle = React.useCallback(() => setStarred(prev => !prev), []);
  return (
    <FaveStar
      itemId={1}
      isStarred={starred}
      showTooltip
      saveFaveStar={toggle}
    />
  );
}`,
    },
  },
};
