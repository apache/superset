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
import { useState } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import Tag from 'src/components/Tag';
import type { CheckableTagProps } from 'src/components/Tag';
import TagType from 'src/types/TagType';

export default {
  title: 'Tag',
  component: Tag,
  argTypes: {
    name: {
      control: 'text',
      description: 'The name of the tag displayed inside',
    },
    editable: {
      control: 'boolean',
      description: 'Whether the tag is editable or not',
    },
    toolTipTitle: {
      control: 'text',
      description: 'Tooltip text for the tag',
    },
    children: {
      control: 'text',
      description: 'Children elements or text inside the tag',
    },
  },
} as Meta<typeof Tag>;

type Story = StoryObj<TagType>;

export const TagStory: Story = {
  args: {
    name: 'Tag',
    onDelete: undefined,
    editable: false,
    onClick: undefined,
    toolTipTitle: 'tooltip',
    children: undefined,
  },
  render: args => <Tag {...args} />,
};

type CheckableTagStoryType = StoryObj<CheckableTagProps>;

export const CheckableTagStory: CheckableTagStoryType = {
  args: {
    checked: false,
  },
  render: args => {
    const [checked, setChecked] = useState(args?.checked || false);
    return (
      <Tag.CheckableTag
        {...args}
        checked={checked}
        onClick={() => setChecked((prev: boolean) => !prev)}
      >
        Click me
      </Tag.CheckableTag>
    );
  },
};
