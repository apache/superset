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
import { Icons } from '../Icons';
import { Button } from '../Button';
import { Upload } from '.';

const meta: Meta<typeof Upload> = {
  title: 'Components/Upload',
  component: Upload,
  argTypes: {
    accept: {
      control: false,
      description: 'File types that can be accepted',
      defaultValue: undefined,
      type: 'string',
    },
    action: {
      control: 'text',
      description: 'Uploading URL',
      defaultValue: undefined,
      type: 'string',
    },
    name: {
      control: false,
      description: 'The name of uploading file',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'file' },
      },
    },
    multiple: {
      control: 'boolean',
      description: 'Support multiple file selection',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable upload button',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    listType: {
      control: 'select',
      options: ['text', 'picture', 'picture-card', 'picture-circle'],
      description: 'Built-in stylesheets for file list display',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'text' },
      },
    },
    showUploadList: {
      control: 'boolean',
      description:
        'Whether to show default upload list, could be an object to specify extra, showPreviewIcon, showRemoveIcon, showDownloadIcon, removeIcon and downloadIcon individually upload list display',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    method: {
      control: false,
      description: 'The HTTP method of upload request',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'post' },
      },
    },
    withCredentials: {
      control: false,
      description: 'Send cookies with ajax upload',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    openFileDialogOnClick: {
      control: 'boolean',
      description: 'Click open file dialog',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    progress: {
      control: false,
      description: 'Custom progress bar',
      table: {
        type: { summary: 'object' },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Upload>;

export const Default: Story = {
  render: args => (
    <Upload {...args}>
      {args.listType !== 'picture-card' &&
      args.listType !== 'picture-circle' ? (
        <Button icon={<Icons.UploadOutlined iconColor="light" iconSize="l" />}>
          Click to Upload
        </Button>
      ) : (
        'Click to Upload'
      )}
    </Upload>
  ),
};
