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
import IconButton from '.';

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  argTypes: {
    icon: {
      control: {
        type: 'select',
        options: [
          '/images/icons/sql.svg',
          '/images/icons/server.svg',
          '/images/icons/image.svg',
          null,
        ],
      },
    },
    onClick: { action: 'clicked' },
  },
  parameters: {
    a11y: {
      enabled: true,
    },
  },
};

export default meta;

type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    buttonText: 'Default IconButton',
    altText: 'Default icon button',
    icon: '/images/icons/sql.svg',
  },
};

export const WithoutIcon: Story = {
  args: {
    buttonText: 'IconButton without custom icon',
  },
};

export const LongText: Story = {
  args: {
    buttonText:
      'This is a very long button text that will be truncated with ellipsis to show multiline behavior',
    icon: '/images/icons/server.svg',
  },
};

export const CustomOnClick: Story = {
  args: {
    buttonText: 'Clickable IconButton',
    icon: '/images/icons/image.svg',
  },
};

export const Disabled: Story = {
  args: {
    buttonText: 'Disabled IconButton',
    icon: '/images/icons/sql.svg',
  },
};
