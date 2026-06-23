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
import { ListViewCard } from '.';

export default {
  title: 'Components/ListViewCard',
  component: ListViewCard,
  parameters: {
    docs: {
      description: {
        component:
          'ListViewCard is a card component used to display items in list views with an image, title, description, and optional cover sections.',
      },
    },
  },
} as Meta<typeof ListViewCard>;

type Story = StoryObj<typeof ListViewCard>;

export const InteractiveListViewCard: Story = {
  args: {
    title: 'Superset Card Title',
    loading: false,
    url: '/superset/dashboard/births/',
    imgURL: 'https://picsum.photos/seed/superset/300/200',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
    coverLeft: 'Left Section',
    coverRight: 'Right Section',
  },
  argTypes: {
    title: {
      control: { type: 'text' },
      description: 'Title displayed on the card.',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Whether the card is in loading state.',
    },
    url: {
      name: 'url',
      control: { type: 'text' },
      description: 'URL the card links to.',
    },
    imgURL: {
      name: 'imgURL',
      control: { type: 'text' },
      description: 'Primary image URL for the card.',
    },
    description: {
      control: { type: 'text' },
      description: 'Description text displayed on the card.',
    },
    coverLeft: {
      control: { type: 'text' },
      description: 'Content for the left section of the cover.',
    },
    coverRight: {
      control: { type: 'text' },
      description: 'Content for the right section of the cover.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A card component for displaying items in list views with images and descriptions.',
      },
      liveExample: `function Demo() {
  return (
    <ListViewCard
      title="My Dashboard"
      description="A sample dashboard card"
      url="/dashboard/1"
      imgURL="https://picsum.photos/seed/demo/300/200"
      coverLeft="Created: Jan 2024"
      coverRight="Views: 1,234"
    />
  );
}`,
    },
  },
};

// Keep original for backwards compatibility
export const SupersetListViewCard: Story = {
  args: {
    title: 'Superset Card Title',
    loading: false,
    url: '/superset/dashboard/births/',
    imgURL: 'https://picsum.photos/seed/superset2/300/200',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
    coverLeft: 'Left Section',
    coverRight: 'Right Section',
  },
};
