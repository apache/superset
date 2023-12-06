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
import React from 'react';
import DvtButton, { DvtButtonProps } from '.';

export default {
  title: 'Dvt-Components/DvtButton',
  component: DvtButton,
  argTypes: {
    label: {
      control: { type: 'text' },
    },
    icon: {
      control: { type: 'text' },
    },
    size: {
      control: {
        type: 'select',
        options: ['small', 'medium', 'large'],
      },
    },
    onClick: {
      action: 'clicked',
    },
    colour: {
      control: {
        type: 'select',
        options: ['primary', 'success', 'grayscale', 'error'],
      },
    },
    typeColour: {
      control: {
        type: 'select',
        options: ['basic', 'powder', 'outline'],
      },
    },
    maxWidth: {
      control: { type: 'boolean' },
    },
  },
};

export const Default = (args: DvtButtonProps) => <DvtButton {...args} />;

Default.args = {
  label: 'Create a New Graph/Chart',
  colour: 'primary',
  typeColour: 'basic',
  size: 'medium',
};

export const Powder = (args: DvtButtonProps) => <DvtButton {...args} />;
Powder.args = {
  label: 'Alert',
  colour: 'primary',
  typeColour: 'powder',
};

export const Success = (args: DvtButtonProps) => <DvtButton {...args} />;
Success.args = {
  label: 'Create a New Graph/Chart',
  colour: 'success',
  typeColour: 'basic',
};

export const Outline = (args: DvtButtonProps) => <DvtButton {...args} />;
Outline.args = {
  label: 'All',
  colour: 'primary',
  typeColour: 'outline',
};

export const Grayscale = (args: DvtButtonProps) => <DvtButton {...args} />;
Grayscale.args = {
  label: 'Mine',
  colour: 'grayscale',
};

export const Error = (args: DvtButtonProps) => <DvtButton {...args} />;
Error.args = {
  label: 'Error/Delete',
  colour: 'error',
};

export const MaxWidth = (args: DvtButtonProps) => <DvtButton {...args} />;
MaxWidth.args = {
  label: 'Create a New Graph/Chart',
  colour: 'primary',
  typeColour: 'basic',
  maxWidth: true,
};

export const Large = (args: DvtButtonProps) => <DvtButton {...args} />;
Large.args = {
  label: 'Alert',
  colour: 'primary',
  typeColour: 'basic',
  size: 'large',
};

export const iconToRight = (args: DvtButtonProps) => <DvtButton {...args} />;
iconToRight.args = {
  label: 'iconToLeft',
  icon: 'dvt-folder',
  iconToRight: true,
};

export const Bold = (args: DvtButtonProps) => <DvtButton {...args} />;
Bold.args = {
  label: 'Bold',
  bold: true,
};
