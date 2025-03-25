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
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import Upload from '.';

const meta: Meta<typeof Upload> = {
  title: 'Upload',
  component: Upload,
  argTypes: {
    accept: { control: 'text', description: 'File types that can be accepted' },
    action: { control: 'text', description: 'Uploading URL' },
    data: { control: 'object', description: 'Uploading extra params' },
    defaultFileList: {
      control: 'object',
      description: 'Default list of uploaded files',
    },
    directory: {
      control: 'boolean',
      description: 'Support whole directory upload',
    },
    disabled: { control: 'boolean', description: 'Disable upload button' },
    fileList: {
      control: 'object',
      description: 'List of uploaded files (controlled)',
    },
    headers: { control: 'object', description: 'Set request headers' },
    listType: {
      control: 'text',
      description: 'Built-in stylesheets (text, picture, etc.)',
    },
    maxCount: {
      control: 'number',
      description: 'Limit number of uploaded files',
    },
    method: {
      control: 'text',
      description: 'The HTTP method of upload request',
    },
    multiple: {
      control: 'boolean',
      description: 'Support multiple file selection',
    },
    name: { control: 'text', description: 'The name of uploading file' },
    openFileDialogOnClick: {
      control: 'boolean',
      description: 'Click open file dialog',
    },
    progress: { control: 'object', description: 'Custom progress bar' },
    showUploadList: {
      control: 'object',
      description: 'Customize upload list display',
    },
    withCredentials: {
      control: 'boolean',
      description: 'Send cookies with ajax upload',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Upload>;

export const Default: Story = {
  render: args => (
    <Upload {...args}>
      <Button icon={<Icons.UploadOutlined iconColor="light" iconSize="l" />}>
        Click to Upload
      </Button>
    </Upload>
  ),
  args: {
    name: 'file',
    multiple: true,
    action: '',
    disabled: false,
    listType: 'text',
    showUploadList: true,
    method: 'post',
    withCredentials: false,
  },
};
