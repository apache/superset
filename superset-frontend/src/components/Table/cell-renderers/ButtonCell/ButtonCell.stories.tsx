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
import { StoryFn, Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { ButtonCell } from './index';

export default {
  title: 'Design System/Components/Table/Cell Renderers/ButtonCell',
  component: ButtonCell,
} as Meta<typeof ButtonCell>;

const clickHandler = action('button cell onClick');

export const Basic: StoryFn<typeof ButtonCell> = args => (
  <ButtonCell {...args} />
);

Basic.args = {
  onClick: clickHandler,
  label: 'Primary',
  row: {
    key: 1,
    buttonCell: 'Click Me',
    textCell: 'Some text',
    euroCell: 45.5,
    dollarCell: 45.5,
  },
};

export const Secondary: StoryFn<typeof ButtonCell> = args => (
  <ButtonCell {...args} />
);

Secondary.args = {
  onClick: clickHandler,
  label: 'Secondary',
  buttonStyle: 'secondary',
  row: {
    key: 1,
    buttonCell: 'Click Me',
    textCell: 'Some text',
    euroCell: 45.5,
    dollarCell: 45.5,
  },
};
