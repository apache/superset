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
import { Button } from '../Button';
import type { ButtonProps } from '../Button/types';
import { ButtonGroup } from '.';

export default {
  title: 'Components/ButtonGroup',
  component: ButtonGroup,
  parameters: {
    docs: {
      description: {
        component:
          'ButtonGroup is a container that groups multiple Button components together with consistent spacing and styling.',
      },
    },
  },
};

import type { ButtonGroupProps } from './types';

// Interactive demo showing ButtonGroup with its own props
export const InteractiveButtonGroup = (args: ButtonGroupProps) => (
  <ButtonGroup {...args}>
    <Button buttonStyle="tertiary">Button 1</Button>
    <Button buttonStyle="tertiary">Button 2</Button>
    <Button buttonStyle="tertiary">Button 3</Button>
  </ButtonGroup>
);

InteractiveButtonGroup.args = {
  expand: false,
};

InteractiveButtonGroup.argTypes = {
  expand: {
    description: 'When true, buttons expand to fill available width.',
    control: 'boolean',
  },
  className: {
    description: 'CSS class name for custom styling.',
    control: 'text',
  },
  children: {
    description: 'Button components to render inside the group.',
    control: false,
  },
};

InteractiveButtonGroup.parameters = {
  actions: {
    disable: true,
  },
  docs: {
    staticProps: {
      expand: false,
    },
    sampleChildren: [
      { component: 'Button', props: { buttonStyle: 'tertiary', children: 'Button 1' } },
      { component: 'Button', props: { buttonStyle: 'tertiary', children: 'Button 2' } },
      { component: 'Button', props: { buttonStyle: 'tertiary', children: 'Button 3' } },
    ],
    liveExample: `function Demo() {
  return (
    <ButtonGroup>
      <Button buttonStyle="tertiary">Button 1</Button>
      <Button buttonStyle="tertiary">Button 2</Button>
      <Button buttonStyle="tertiary">Button 3</Button>
    </ButtonGroup>
  );
}`,
  },
};

// Gallery showing different button styles in groups
export const ButtonGroupGallery = (args: ButtonProps) => (
  <>
    <ButtonGroup css={{ marginBottom: 40 }}>
      <Button {...args}>Button 1</Button>
    </ButtonGroup>
    <ButtonGroup css={{ marginBottom: 40 }}>
      <Button {...args}>Button 1</Button>
      <Button {...args}>Button 2</Button>
    </ButtonGroup>
    <ButtonGroup>
      <Button {...args}>Button 1</Button>
      <Button {...args}>Button 2</Button>
      <Button {...args}>Button 3</Button>
    </ButtonGroup>
  </>
);

ButtonGroupGallery.args = {
  buttonStyle: 'tertiary',
  buttonSize: 'default',
};

ButtonGroupGallery.argTypes = {
  buttonStyle: {
    description: 'Style variant for the buttons.',
    control: { type: 'select' },
    options: ['primary', 'secondary', 'tertiary', 'dashed', 'link', 'warning', 'danger'],
  },
  buttonSize: {
    description: 'Size of the buttons.',
    control: { type: 'select' },
    options: ['default', 'small', 'xsmall'],
  },
};

ButtonGroupGallery.parameters = {
  actions: {
    disable: true,
  },
};
