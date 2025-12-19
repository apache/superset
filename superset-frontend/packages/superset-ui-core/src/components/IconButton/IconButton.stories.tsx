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
import { Meta, StoryObj } from '@storybook/react';
import { IconButton } from '.';

export default {
  title: 'Components/IconButton',
  component: IconButton,
  argTypes: {
    altText: {
      control: 'text',
      description:
        'The alt text for the button. If not provided, the button text is used as the alt text by default.',
      table: {
        type: { summary: 'string' },
      },
    },
    buttonText: {
      control: 'text',
      description: 'The text inside the button',
      table: {
        type: { summary: 'string' },
      },
    },
    icon: {
      control: false,
      description: 'Icon inside the button',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'string' },
      },
    },
    padded: {
      control: 'boolean',
      description: 'add padding between icon and button text',
      table: {
        type: { summary: 'boolean' },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The IconButton component is a versatile button that allows you to combine an icon with a text label. It is designed for use in situations where you want to display an icon along with some text in a single clickable element.',
      },
      a11y: {
        enabled: true,
      },
    },
  },
} as Meta<typeof IconButton>;

type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    buttonText: 'Default IconButton',
  },
};

export const CustomIcon: Story = {
  args: {
    buttonText: 'Custom icon IconButton',
    icon: '/images/sqlite.png',
  },
};
