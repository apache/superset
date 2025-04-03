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
import TagsList, { TagsListProps } from '.';

export default {
  title: 'TagsList',
  component: TagsList,
  argsTypes: {
    tags: {
      control: 'array',
      description: 'List of tags to display',
    },
    editable: {
      control: 'boolean',
      description: 'Whether tags are editable or not',
    },
    maxTags: {
      control: 'number',
      description: 'Maximum number of tags to display',
    },
  },
} as Meta<typeof TagsList>;

type Story = StoryObj<typeof TagsList>;

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
    editable: true,
    maxTags: 3,
  },
  render: (args: TagsListProps) => <TagsList {...args} />,
};
