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
import { Tag } from 'src/components/Tag';
import type { CheckableTagProps } from 'src/components/Tag';
import TagType from 'src/types/TagType';

export default {
  title: 'Components/Tag',
  component: Tag,
  argTypes: {
    name: {
      control: 'text',
      description: 'The name of the tag displayed inside',
      table: {
        category: 'Tag custom properties',
        type: { summary: 'number | object' },
      },
    },
    editable: {
      control: 'boolean',
      description: 'Whether the tag is editable or not',
      table: {
        category: 'Tag custom properties',
        type: { summary: 'number | object' },
      },
    },
    toolTipTitle: {
      control: 'text',
      description: 'Tooltip text for the tag',
      table: {
        category: 'Tag custom properties',
        type: { summary: 'number | object' },
      },
    },
    color: {
      control: 'text',
      description: 'Color of the Tag',
      table: {
        category: 'Tag',
        type: { summary: 'text' },
      },
    },
    icon: {
      control: false,
      description: 'Set the icon of tag',
      table: {
        category: 'Tag',
        type: { summary: 'ReactNode' },
      },
    },
    bordered: {
      control: 'boolean',
      description: 'Whether the tag has a border or not',
      table: {
        category: 'Tag',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    checked: {
      confirm: 'boolean',
      control: 'boolean',
      description: 'Whether the tag is checked or not',
      table: {
        category: 'CheckableTag',
        type: { summary: 'number | object' },
      },
    },
    // Exclude unwanted properties
    children: {
      table: {
        disable: true,
      },
    },
    closable: {
      table: {
        disable: true,
      },
    },
    css: {
      table: {
        disable: true,
      },
    },
    id: {
      table: {
        disable: true,
      },
    },
    index: {
      table: {
        disable: true,
      },
    },
    onClick: {
      table: {
        disable: true,
      },
    },
    onClose: {
      table: {
        disable: true,
      },
    },
    onDelete: {
      table: {
        disable: true,
      },
    },
    role: {
      table: {
        disable: true,
      },
    },
    style: {
      table: {
        disable: true,
      },
    },
    type: {
      table: {
        disable: true,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The Tag component is used to display a tag with various properties such as color, closable, and editable. It can also be used as a CheckableTag which allows for selection.',
      },
    },
  },
} as Meta<typeof Tag>;

type Story = StoryObj<TagType>;

export const TagStory: Story = {
  args: {
    name: 'Tag',
  },
  render: args => (
    <div>
      <Tag {...args} />
    </div>
  ),
};

type CheckableTagStoryType = StoryObj<CheckableTagProps>;

export const CheckableTagStory: CheckableTagStoryType = {
  args: {
    checked: false,
  },
  render: args => {
    const [checked, setChecked] = useState(args?.checked || false);
    return (
      <div>
        <Tag.CheckableTag
          {...args}
          checked={checked}
          onClick={() => setChecked((prev: boolean) => !prev)}
        >
          Click me
        </Tag.CheckableTag>
      </div>
    );
  },
};
