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
import { Space } from '../Space';
import { Skeleton, type SkeletonProps } from '.';

const { Avatar, Button, Input, Image } = Skeleton;

type SkeletonStoryArgs = SkeletonProps & {
  shape?: 'circle' | 'square';
  size?: 'large' | 'small' | 'default';
  block?: boolean;
};

export default {
  title: 'Components/Skeleton',
  component: Skeleton,
  subcomponents: { Avatar, Button, Input, Image },
  parameters: {
    docs: {
      description: {
        component:
          'Skeleton loading component with support for avatar, title, paragraph, button, and input placeholders.',
      },
    },
  },
} as Meta<typeof Skeleton>;

type Story = StoryObj<SkeletonStoryArgs>;

export const InteractiveSkeleton: Story = {
  args: {
    active: true,
    avatar: false,
    loading: true,
    title: true,
    shape: 'circle',
    size: 'default',
    block: false,
  },
  argTypes: {
    active: {
      control: 'boolean',
      description: 'Show animation effect.',
    },
    avatar: {
      control: 'boolean',
      description: 'Show avatar placeholder.',
    },
    loading: {
      control: 'boolean',
      description: 'Display the skeleton when true.',
    },
    title: {
      control: 'boolean',
      description: 'Show title placeholder.',
    },
    shape: {
      control: 'select',
      description: 'Shape of the avatar/button skeleton.',
      options: ['circle', 'square'],
    },
    size: {
      control: 'select',
      options: ['large', 'small', 'default'],
      description: 'Size of the skeleton elements.',
    },
    block: {
      control: 'boolean',
      description: 'Option to fit button width to its parent width.',
    },
  },
  render: args => {
    const avatar = {
      shape: args.shape,
      size: args.size,
    };
    const button = {
      block: args.block,
      shape: args.shape,
      size: args.size,
    };

    return (
      <Space direction="vertical" size="middle">
        Skeleton
        <Skeleton {...args} />
        Avatar
        <Skeleton.Avatar {...avatar} />
        Button
        <Skeleton.Button {...button} />
      </Space>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'A loading placeholder for content that is not yet loaded.',
      },
      liveExample: `function Demo() {
  return (
    <Skeleton active avatar paragraph={{ rows: 4 }} />
  );
}`,
    },
  },
};

// Keep original for backwards compatibility
export const SkeletonStory: Story = {
  render: args => {
    const avatar = {
      shape: args.shape,
      size: args.size,
    };
    const button = {
      block: args.block,
      shape: args.shape,
      size: args.size,
    };

    return (
      <Space direction="vertical" size="middle">
        Skeleton
        <Skeleton {...args} />
        Avatar
        <Skeleton.Avatar {...avatar} />
        Button
        <Skeleton.Button {...button} />
      </Space>
    );
  },
};
