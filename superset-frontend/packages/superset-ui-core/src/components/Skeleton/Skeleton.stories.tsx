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
import { type SkeletonButtonProps } from 'antd/es/skeleton/Button';
import { Space } from '../Space';
import { AvatarProps } from '../Avatar/types';
import { Skeleton, type SkeletonProps } from '.';

const { Avatar, Button, Input, Image } = Skeleton;

export default {
  title: 'Components/Skeleton',
  component: Skeleton,
  subcomponents: { Avatar, Button, Input, Image },
  argTypes: {
    // Skeleton props
    active: {
      control: 'boolean',
      description: 'Show animation effect',
      table: {
        category: 'Skeleton',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    avatar: {
      control: 'boolean',
      description: 'Show avatar placeholder',
      table: {
        category: 'Skeleton',
        type: { summary: 'boolean | object' },
        defaultValue: { summary: false },
      },
    },
    loading: {
      control: 'boolean',
      description: 'Display the skeleton when true',
      table: {
        category: 'Skeleton',
        type: { summary: 'boolean' },
      },
    },
    paragraph: {
      control: 'false',
      description: 'Paragraph skeleton',
      table: {
        category: 'Skeleton',
        type: { summary: 'boolean | object' },
        defaultValue: { summary: 'true' },
      },
    },
    round: {
      control: false,
      description: 'Show paragraph and title radius when true	',
      table: {
        category: 'Skeleton',
        type: { summary: 'boolean' },
        defaultValue: { summary: false },
      },
    },
    title: {
      control: 'boolean',
      description: 'Show title placeholder',
      table: {
        category: 'Skeleton',
        type: { summary: 'boolean | object' },
        defaultValue: { summary: true },
      },
    },

    // Skeleton.Avatar props
    shape: {
      control: 'select',
      description: 'Shape of the avatar',
      options: ['circle', 'square'],
      table: {
        name: 'shape',
        category: 'Avatar | Button',
        type: { summary: 'string' },
      },
    },
    size: {
      control: 'select',
      options: ['large', 'small', 'default'],
      description: 'Set the size of avatar in the skeleton',
      table: {
        category: 'Avatar | Button',
        type: { summary: 'number | string' },
      },
    },

    // Skeleton.Title props
    width: {
      control: false,
      description: 'Set the width of title in the skeleton',
      table: {
        category: 'Title',
        type: { summary: 'number | string' },
      },
    },

    // Skeleton.Button props
    block: {
      control: 'boolean',
      description: 'Option to fit button width to its parent width',
      table: {
        category: 'Button',
        type: { summary: 'boolean' },
        defaultValue: { summary: false },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Skeleton loading component with support for avatar, title, paragraph, button, and input placeholders.',
      },
    },
  },
} as Meta<
  typeof Skeleton & typeof Avatar & typeof Button & typeof Input & typeof Image
>;

type Story = StoryObj<typeof Skeleton & typeof Button & typeof Avatar>;

export const SkeletonStory: Story = {
  render: (args: SkeletonProps & AvatarProps & SkeletonButtonProps) => {
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
