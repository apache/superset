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
import Typography from 'src/components/Typography';

const meta: Meta<typeof Typography.Text> = {
  title: 'Components/Typography',
  component: Typography,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['secondary', 'success', 'warning', 'danger'],
    },
    strong: { control: 'boolean' },
    underline: { control: 'boolean' },
    delete: { control: 'boolean' },
    mark: { control: 'boolean' },
    code: { control: 'boolean' },
    italic: { control: 'boolean' },
    disabled: { control: 'boolean' },
    editable: { control: 'boolean' },
    ellipsis: { control: 'boolean' },
    keyboard: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Typography.Text>;

export const Default: Story = {
  args: {
    children: 'Default Text',
    strong: true,
    underline: false,
    type: 'secondary',
    code: true,
    disabled: false,
    delete: false,
    copyable: false,
    editable: false,
    ellipsis: false,
    keyboard: false,
    mark: false,
    italic: false,
  },
};

export const Title: StoryObj<typeof Typography.Title> = {
  render: args => <Typography.Title {...args} />,
  args: {
    children: 'Title Example',
    level: 2,
    underline: false,
    type: 'secondary',
    code: false,
    disabled: true,
    delete: true,
    copyable: true,
    editable: false,
    ellipsis: false,
    keyboard: false,
    mark: false,
    italic: false,
  },
};

export const Paragraph: StoryObj<typeof Typography.Paragraph> = {
  render: args => <Typography.Paragraph {...args} />,
  args: {
    children:
      'This is a paragraph with multiple lines. It can have different styles.',
    strong: true,
    underline: false,
    type: 'secondary',
    code: true,
    disabled: false,
    delete: false,
    copyable: false,
    editable: false,
    ellipsis: false,
    keyboard: false,
    mark: false,
    italic: false,
  },
};

export const copyable: StoryObj<typeof Typography.Link> = {
  render: args => <Typography.Link {...args} />,
  args: {
    children: 'Click me',
    href: 'https://example.com',
  },
};

export const Link: StoryObj<typeof Typography.Link> = {
  render: args => <Typography.Link {...args} />,
  args: {
    children: 'Click me',
    href: 'https://example.com',
  },
};
