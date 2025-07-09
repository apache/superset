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
import { Breadcrumb } from '.';

export default {
  title: 'Components/Breadcrumb',
  component: Breadcrumb,
  argTypes: {
    separator: {
      control: 'text',
      description: 'Custom separator between items',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: '/' },
      },
    },
    items: {
      control: false,
      description: 'List of breadcrumb items',
      table: {
        type: { summary: 'object' },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'Breadcrumb component for displaying navigation paths',
      },
    },
  },
} as Meta<typeof Breadcrumb>;

type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {
  args: {
    items: [
      { title: 'Home', href: '/' },
      { title: 'Library', href: '/library' },
      { title: 'Data' },
    ],
  },
  render: args => <Breadcrumb {...args} />,
};
