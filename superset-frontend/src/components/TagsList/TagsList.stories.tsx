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
import { TagsList, type TagsListProps } from 'src/components/TagsList';

export default {
  title: 'Components/TagsList',
  component: TagsList,
  argTypes: {
    tags: {
      control: false,
      description: 'List of tags to display',
      table: {
        category: 'Tag List',
        type: { summary: 'number | object' },
      },
    },
    editable: {
      control: 'boolean',
      description: 'Whether the tags are editable',
      table: {
        category: 'Tag List',
        type: { summary: 'boolean' },
      },
    },
    maxTags: {
      control: 'number',
      description: 'Maximum number of tags to display',
      table: {
        category: 'Tag List',
        type: { summary: 'number | undefined' },
      },
    },
    onDelete: {
      table: {
        disable: true,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The TagsList component displays a list of tags. It can be configured to be editable, allowing users to delete tags. The maxTags prop limits the number of tags displayed before truncating.',
      },
    },
  },
} as Meta<TagsListProps>;

type Story = StoryObj<TagsListProps>;

export const TagsListStory: Story = {
  args: {
    tags: [
      { name: 'tag1' },
      { name: 'tag2' },
      { name: 'tag3' },
      { name: 'tag4' },
      { name: 'tag5' },
      { name: 'tag6' },
    ],
  },
  render: (args: TagsListProps) => <TagsList {...args} />,
};
