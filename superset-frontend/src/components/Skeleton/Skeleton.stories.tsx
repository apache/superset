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
import Skeleton from './index';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
  argTypes: {
    active: { control: 'boolean', description: 'Display animation effect' },
    avatar: { control: 'boolean', description: 'Display avatar skeleton' },
    loading: { control: 'boolean', description: 'Whether skeleton is loading' },
    title: { control: 'boolean', description: 'Show skeleton title' },
    paragraph: { control: 'object', description: 'Show skeleton paragraphs' },
    round: { control: 'boolean', description: 'Make avatar and image round' },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    active: false,
    avatar: false,
    loading: false,
    title: true,
    paragraph: { rows: 3 },
    round: false,
  },
};
