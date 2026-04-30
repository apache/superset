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
import { Avatar } from '.';
import type { AvatarProps } from './types';

export default {
  title: 'Components/Avatar',
  component: Avatar,
};

export const InteractiveAvatar = (args: AvatarProps) => <Avatar {...args} />;

InteractiveAvatar.args = {
  children: 'AB',
  alt: '',
  gap: 4,
  shape: 'circle',
  size: 'default',
  src: '',
  draggable: false,
};

InteractiveAvatar.argTypes = {
  children: {
    description: 'Text or initials to display inside the avatar.',
    control: { type: 'text' },
  },
  shape: {
    description: 'The shape of the avatar.',
    options: ['circle', 'square'],
    control: { type: 'select' },
  },
  size: {
    description: 'The size of the avatar.',
    options: ['small', 'default', 'large'],
    control: { type: 'select' },
  },
  src: {
    description: 'Image URL for the avatar. If provided, overrides children.',
    control: { type: 'text' },
  },
  gap: {
    description: 'Letter spacing inside the avatar.',
    control: { type: 'number', min: 0, max: 10 },
  },
};
