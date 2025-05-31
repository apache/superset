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
import { Typography } from '.';

export default {
  title: 'Components/Typography',
  component: Typography,
  subcomponents: {
    Text: Typography.Text,
    Title: Typography.Title,
    Paragraph: Typography.Paragraph,
    Link: Typography.Link,
  },
  argTypes: {
    code: {
      control: 'boolean',
      description: 'Code style',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    copyable: {
      control: 'boolean',
      description: 'Whether to be copyable, customize it via setting an object',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    delete: {
      control: 'boolean',
      description: 'Deleted line style',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled content',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    editable: {
      control: 'boolean',
      description: 'Whether to be editable, customize it via setting an object',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    ellipsis: {
      control: 'boolean',
      description:
        'Display ellipsis when text overflows, can not configure expandable、rows and onExpand by using object. Diff with Typography.Paragraph, Text do not have 100% width style which means it will fix width on the first ellipsis. If you want to have responsive ellipsis, please set width manually',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    keyboard: {
      control: 'boolean',
      description: 'Keyboard style',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    mark: {
      control: 'boolean',
      description: 'Marked style',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    italic: {
      control: 'boolean',
      description: 'Italic style',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    type: {
      control: 'select',
      description: 'Text type',
      options: ['secondary', 'success', 'warning', 'danger'],
      table: {
        category: 'Typography.Text',
        type: { summary: 'string' },
      },
    },
    underline: {
      control: 'boolean',
      description: 'Underlined style	',
      table: {
        category: 'Typography.Text',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    level: {
      control: {
        type: 'number',
        min: 1,
        max: 5,
      },
      description: 'Set content importance. Match with h1, h2, h3, h4, h5',
      table: {
        category: 'Typography.Title',
        type: { summary: 'number' },
      },
    },
    strong: {
      control: 'boolean',
      description: 'Bold style',
      table: {
        category: 'Typography.Paragraph',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Typography is a component for displaying text with various styles and formats. It includes subcomponents like Title, Paragraph, and Link.',
      },
    },
  },
} as Meta<
  typeof Typography.Text &
    typeof Typography.Paragraph &
    typeof Typography.Link &
    typeof Typography.Title
>;

type TextStory = StoryObj<typeof Typography.Text>;

export const TextStory: TextStory = {
  args: {
    children: 'Default Text',
  },
  render: args => <Typography.Text {...args} />,
};

type TitleStory = StoryObj<typeof Typography.Title>;

export const TitleStory: TitleStory = {
  args: {
    children: 'Default Title',
  },
  render: args => <Typography.Title {...args} />,
};
type ParagraphStory = StoryObj<typeof Typography.Paragraph>;

export const ParagraphStory: ParagraphStory = {
  args: {
    children: 'Default Paragraph',
  },
  render: args => <Typography.Paragraph {...args} />,
};

type LinkStory = StoryObj<typeof Typography.Link>;

export const LinkStory: LinkStory = {
  args: {
    children: 'Default Link',
    href: 'https://example.com',
    target: '_blank',
  },
  render: args => <Typography.Link {...args} />,
};
