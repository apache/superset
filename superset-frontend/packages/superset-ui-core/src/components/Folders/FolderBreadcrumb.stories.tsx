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
import { action } from 'storybook/actions';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import type { FolderBreadcrumbProps } from './types';

export default {
  title: 'Components/Folders/FolderBreadcrumb',
  component: FolderBreadcrumb,
  parameters: {
    docs: {
      description: {
        component:
          'Folder navigation breadcrumb. Uses a `>` separator, a folder icon per ' +
          'segment (open folder for the current location), and semantic emphasis ' +
          'on the trailing segment.',
      },
    },
  },
};

const samplePath = [
  { key: 'root', title: 'All assets' },
  { key: 'marketing', title: 'Marketing' },
  { key: 'q2', title: 'Q2 Campaigns' },
];

export const InteractiveFolderBreadcrumb = (args: FolderBreadcrumbProps) => (
  <FolderBreadcrumb {...args} />
);

InteractiveFolderBreadcrumb.args = {
  items: samplePath,
  separator: '>',
};

InteractiveFolderBreadcrumb.argTypes = {
  separator: {
    description: 'Separator rendered between segments.',
    control: 'text',
  },
  items: {
    description:
      'Ordered folder path from root to current; the last item is the current location.',
    control: false,
  },
};

export const Clickable = () => (
  <FolderBreadcrumb
    items={samplePath.map(item => ({
      ...item,
      onClick: action(`navigate:${item.key}`),
    }))}
  />
);

Clickable.parameters = {
  controls: { disable: true },
  docs: {
    description: {
      story:
        'Parent segments become links when given an `onClick`; hovering shows the ' +
        'primary color and clicking fires the handler.',
    },
  },
};
